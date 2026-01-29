// ============================================================================
// SCREENSHOT CAPTURE
// Uses native browser capabilities with canvas fallback
// ============================================================================

import type { Annotation } from "../types";

interface ScreenshotOptions {
  quality?: number;
  format?: "png" | "jpeg" | "webp";
  maxWidth?: number;
  maxHeight?: number;
  maskSelectors?: string[];
  blockSelectors?: string[];
}

interface ScreenshotResult {
  blob: Blob;
  width: number;
  height: number;
  devicePixelRatio: number;
}

// Mask sensitive elements
function maskElements(doc: Document, selectors: string[]): () => void {
  const masked: Array<{ el: HTMLElement; original: string }> = [];

  selectors.forEach((selector) => {
    doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      masked.push({ el, original: el.innerHTML });
      el.innerHTML =
        '<span style="background:#ccc;display:block;width:100%;height:100%"></span>';
    });
  });

  return () => {
    masked.forEach(({ el, original }) => {
      el.innerHTML = original;
    });
  };
}

// Block elements (hide completely)
function blockElements(doc: Document, selectors: string[]): () => void {
  const blocked: Array<{ el: HTMLElement; original: string }> = [];

  selectors.forEach((selector) => {
    doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      blocked.push({ el, original: el.style.visibility });
      el.style.visibility = "hidden";
    });
  });

  return () => {
    blocked.forEach(({ el, original }) => {
      el.style.visibility = original;
    });
  };
}

// Canvas-based screenshot capture (fallback)
async function captureWithCanvas(
  options: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  const {
    quality = 0.92,
    format = "png",
    maxWidth = 1920,
    maxHeight = 1080,
    maskSelectors = [],
    blockSelectors = [],
  } = options;

  // Apply masking
  const unmask = maskElements(document, maskSelectors);
  const unblock = blockElements(document, blockSelectors);

  try {
    // Use html2canvas dynamically imported
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(document.documentElement, {
      logging: false,
      useCORS: true,
      allowTaint: true,
      scale: Math.min(window.devicePixelRatio, 2),
      width: Math.min(window.innerWidth, maxWidth),
      height: Math.min(window.innerHeight, maxHeight),
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    const mimeType =
      format === "png"
        ? "image/png"
        : format === "jpeg"
          ? "image/jpeg"
          : "image/webp";

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            resolve({
              blob,
              width: canvas.width,
              height: canvas.height,
              devicePixelRatio: window.devicePixelRatio,
            });
          } else {
            reject(new Error("Failed to create screenshot blob"));
          }
        },
        mimeType,
        quality,
      );
    });
  } finally {
    unmask();
    unblock();
  }
}

// Native screen capture (if available)
async function captureNative(): Promise<ScreenshotResult | null> {
  try {
    // Check if getDisplayMedia is available
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return null;
    }

    // This requires user gesture and permission
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
      } as MediaTrackConstraints,
    });

    const track = stream.getVideoTracks()[0];
    const imageCapture = new (window as any).ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);

    // Stop the stream
    stream.getTracks().forEach((t) => t.stop());

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          resolve({
            blob,
            width: canvas.width,
            height: canvas.height,
            devicePixelRatio: window.devicePixelRatio,
          });
        } else {
          reject(new Error("Failed to create screenshot blob"));
        }
      }, "image/png");
    });
  } catch {
    return null;
  }
}

// Main capture function
export async function captureScreenshot(
  options: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  // Try native first (commented out as it requires user interaction)
  // const nativeResult = await captureNative();
  // if (nativeResult) return nativeResult;

  // Fall back to canvas
  return captureWithCanvas(options);
}

// Draw annotations on screenshot
export async function applyAnnotations(
  screenshot: Blob,
  annotations: Annotation[],
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(screenshot);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Draw original screenshot
      ctx.drawImage(img, 0, 0);

      // Draw annotations
      annotations.forEach((annotation) => {
        ctx.strokeStyle = annotation.color || "#ff0000";
        ctx.fillStyle = annotation.color || "#ff0000";
        ctx.lineWidth = 3;

        switch (annotation.type) {
          case "rectangle":
            ctx.strokeRect(
              annotation.x,
              annotation.y,
              annotation.width || 100,
              annotation.height || 100,
            );
            break;

          case "circle":
            ctx.beginPath();
            ctx.arc(
              annotation.x + (annotation.width || 50) / 2,
              annotation.y + (annotation.height || 50) / 2,
              (annotation.width || 50) / 2,
              0,
              2 * Math.PI,
            );
            ctx.stroke();
            break;

          case "arrow":
            ctx.beginPath();
            ctx.moveTo(annotation.x, annotation.y);
            ctx.lineTo(
              annotation.x + (annotation.width || 50),
              annotation.y + (annotation.height || 50),
            );
            ctx.stroke();
            // Arrowhead
            const angle = Math.atan2(
              annotation.height || 0,
              annotation.width || 0,
            );
            const headLength = 15;
            ctx.beginPath();
            ctx.moveTo(
              annotation.x + (annotation.width || 50),
              annotation.y + (annotation.height || 50),
            );
            ctx.lineTo(
              annotation.x +
                (annotation.width || 50) -
                headLength * Math.cos(angle - Math.PI / 6),
              annotation.y +
                (annotation.height || 50) -
                headLength * Math.sin(angle - Math.PI / 6),
            );
            ctx.lineTo(
              annotation.x +
                (annotation.width || 50) -
                headLength * Math.cos(angle + Math.PI / 6),
              annotation.y +
                (annotation.height || 50) -
                headLength * Math.sin(angle + Math.PI / 6),
            );
            ctx.closePath();
            ctx.fill();
            break;

          case "highlight":
            ctx.fillStyle = (annotation.color || "#ffff00") + "40"; // 25% opacity
            ctx.fillRect(
              annotation.x,
              annotation.y,
              annotation.width || 100,
              annotation.height || 30,
            );
            break;

          case "blur":
            // For blur, we'd need more complex processing
            ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
            ctx.fillRect(
              annotation.x,
              annotation.y,
              annotation.width || 100,
              annotation.height || 100,
            );
            break;

          case "text":
            ctx.font = "16px sans-serif";
            ctx.fillText(annotation.text || "", annotation.x, annotation.y);
            break;
        }
      });

      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to apply annotations"));
        }
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load screenshot for annotation"));
    };

    img.src = url;
  });
}
