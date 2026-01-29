// ============================================================================
// ANNOTATION LAYER COMPONENT
// Canvas overlay for drawing annotations
// ============================================================================

import { createElement, generateId } from "../../utils/dom";
import type { Annotation } from "../../../types";
import type { AnnotationTool } from "./AnnotationToolbar";

export interface AnnotationLayerConfig {
  width: number;
  height: number;
  tool?: AnnotationTool;
  color?: string;
  onAnnotationAdd?: (annotation: Annotation) => void;
}

export const annotationLayerStyles = `
  .relay-annotation-layer {
    position: absolute;
    inset: 0;
    cursor: crosshair;
  }

  .relay-annotation-layer--text {
    cursor: text;
  }

  .relay-annotation-layer__canvas {
    width: 100%;
    height: 100%;
  }

  .relay-annotation-layer__text-input {
    position: absolute;
    padding: 4px 8px;
    font-family: inherit;
    font-size: 16px;
    color: inherit;
    background: white;
    border: 2px solid currentColor;
    border-radius: 4px;
    outline: none;
    min-width: 100px;
  }
`;

export interface AnnotationLayerResult {
  element: HTMLDivElement;
  canvas: HTMLCanvasElement;
  setTool: (tool: AnnotationTool) => void;
  setColor: (color: string) => void;
  getAnnotations: () => Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  undo: () => Annotation | null;
  redo: () => Annotation | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  redraw: () => void;
}

export function createAnnotationLayer(
  config: AnnotationLayerConfig,
): AnnotationLayerResult {
  const {
    width,
    height,
    tool = "arrow",
    color = "#ef4444",
    onAnnotationAdd,
  } = config;

  let currentTool: AnnotationTool = tool;
  let currentColor: string = color;
  let annotations: Annotation[] = [];
  let undoneAnnotations: Annotation[] = [];
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let currentAnnotation: Partial<Annotation> | null = null;

  // Create container
  const container = createElement("div", {
    class: "relay-annotation-layer",
  }) as HTMLDivElement;

  // Create canvas
  const canvas = createElement("canvas", {
    class: "relay-annotation-layer__canvas",
    width: width,
    height: height,
  }) as HTMLCanvasElement;

  const ctx = canvas.getContext("2d")!;

  container.appendChild(canvas);

  // Get mouse position relative to canvas
  const getMousePos = (
    e: MouseEvent | TouchEvent,
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Draw all annotations
  const redraw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.forEach((annotation) => {
      drawAnnotation(ctx, annotation);
    });

    // Draw current annotation being created
    if (currentAnnotation && currentAnnotation.type) {
      drawAnnotation(ctx, currentAnnotation as Annotation);
    }
  };

  // Draw a single annotation
  const drawAnnotation = (
    context: CanvasRenderingContext2D,
    annotation: Annotation | Partial<Annotation>,
  ) => {
    context.strokeStyle = annotation.color || currentColor;
    context.fillStyle = annotation.color || currentColor;
    context.lineWidth = 3;

    const x = annotation.x || 0;
    const y = annotation.y || 0;
    const w = annotation.width || 0;
    const h = annotation.height || 0;

    switch (annotation.type) {
      case "rectangle":
        context.strokeRect(x, y, w, h);
        break;

      case "circle":
        context.beginPath();
        const radiusX = Math.abs(w) / 2;
        const radiusY = Math.abs(h) / 2;
        context.ellipse(
          x + w / 2,
          y + h / 2,
          radiusX,
          radiusY,
          0,
          0,
          2 * Math.PI,
        );
        context.stroke();
        break;

      case "arrow":
        // Draw line
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + w, y + h);
        context.stroke();

        // Draw arrowhead
        const angle = Math.atan2(h, w);
        const headLength = 15;
        context.beginPath();
        context.moveTo(x + w, y + h);
        context.lineTo(
          x + w - headLength * Math.cos(angle - Math.PI / 6),
          y + h - headLength * Math.sin(angle - Math.PI / 6),
        );
        context.lineTo(
          x + w - headLength * Math.cos(angle + Math.PI / 6),
          y + h - headLength * Math.sin(angle + Math.PI / 6),
        );
        context.closePath();
        context.fill();
        break;

      case "highlight":
        context.fillStyle = (annotation.color || currentColor) + "40"; // 25% opacity
        context.fillRect(x, y, w, h);
        break;

      case "blur":
        // Simplified blur effect - just a semi-transparent rectangle
        context.fillStyle = "rgba(128, 128, 128, 0.6)";
        context.fillRect(x, y, w, h);
        break;

      case "text":
        if (annotation.text) {
          context.font = "16px sans-serif";
          context.fillText(annotation.text, x, y);
        }
        break;
    }
  };

  // Handle text annotation
  let textInput: HTMLInputElement | null = null;

  const createTextInput = (x: number, y: number) => {
    // Remove existing input
    if (textInput) {
      textInput.remove();
    }

    textInput = createElement("input", {
      type: "text",
      class: "relay-annotation-layer__text-input",
    }) as HTMLInputElement;
    textInput.style.left = `${(x / canvas.width) * 100}%`;
    textInput.style.top = `${(y / canvas.height) * 100}%`;
    textInput.style.color = currentColor;
    textInput.style.borderColor = currentColor;

    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        finishTextInput();
      } else if (e.key === "Escape") {
        textInput?.remove();
        textInput = null;
      }
    });

    textInput.addEventListener("blur", finishTextInput);

    container.appendChild(textInput);
    textInput.focus();
  };

  const finishTextInput = () => {
    if (!textInput || !textInput.value.trim()) {
      textInput?.remove();
      textInput = null;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (parseFloat(textInput.style.left) / 100) * canvas.width;
    const y = (parseFloat(textInput.style.top) / 100) * canvas.height;

    const annotation: Annotation = {
      id: generateId("annotation"),
      type: "text",
      x,
      y: y + 16, // Offset for text baseline
      color: currentColor,
      text: textInput.value.trim(),
    };

    annotations.push(annotation);
    undoneAnnotations = [];
    onAnnotationAdd?.(annotation);
    redraw();

    textInput.remove();
    textInput = null;
  };

  // Mouse/touch event handlers
  const handleStart = (e: MouseEvent | TouchEvent) => {
    if (currentTool === "text") {
      const pos = getMousePos(e);
      createTextInput(pos.x, pos.y);
      return;
    }

    isDrawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;

    currentAnnotation = {
      id: generateId("annotation"),
      type: currentTool,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
      color: currentColor,
    };
  };

  const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing || !currentAnnotation) return;

    const pos = getMousePos(e);
    currentAnnotation.width = pos.x - startX;
    currentAnnotation.height = pos.y - startY;

    redraw();
  };

  const handleEnd = () => {
    if (!isDrawing || !currentAnnotation) return;

    isDrawing = false;

    // Only add annotation if it has some size
    const minSize = 5;
    if (
      Math.abs(currentAnnotation.width || 0) > minSize ||
      Math.abs(currentAnnotation.height || 0) > minSize
    ) {
      annotations.push(currentAnnotation as Annotation);
      undoneAnnotations = [];
      onAnnotationAdd?.(currentAnnotation as Annotation);
    }

    currentAnnotation = null;
    redraw();
  };

  // Bind events
  canvas.addEventListener("mousedown", handleStart);
  canvas.addEventListener("mousemove", handleMove);
  canvas.addEventListener("mouseup", handleEnd);
  canvas.addEventListener("mouseleave", handleEnd);

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleStart(e);
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    handleMove(e);
  });
  canvas.addEventListener("touchend", handleEnd);

  return {
    element: container,
    canvas,
    setTool: (newTool: AnnotationTool) => {
      currentTool = newTool;
      container.classList.toggle(
        "relay-annotation-layer--text",
        newTool === "text",
      );
    },
    setColor: (newColor: string) => {
      currentColor = newColor;
    },
    getAnnotations: () => [...annotations],
    setAnnotations: (newAnnotations: Annotation[]) => {
      annotations = [...newAnnotations];
      undoneAnnotations = [];
      redraw();
    },
    undo: () => {
      if (annotations.length === 0) return null;
      const undone = annotations.pop()!;
      undoneAnnotations.push(undone);
      redraw();
      return undone;
    },
    redo: () => {
      if (undoneAnnotations.length === 0) return null;
      const redone = undoneAnnotations.pop()!;
      annotations.push(redone);
      redraw();
      return redone;
    },
    canUndo: () => annotations.length > 0,
    canRedo: () => undoneAnnotations.length > 0,
    clear: () => {
      annotations = [];
      undoneAnnotations = [];
      redraw();
    },
    redraw,
  };
}
