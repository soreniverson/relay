// ============================================================================
// SCREENSHOT EDITOR COMPONENT
// Full-screen annotation editor
// ============================================================================

import { createElement, waitForAnimation } from "../../utils/dom";
import {
  createAnnotationToolbar,
  type AnnotationToolbarResult,
  type AnnotationTool,
} from "./AnnotationToolbar";
import {
  createAnnotationLayer,
  type AnnotationLayerResult,
} from "./AnnotationLayer";
import { createButton } from "../shared/Button";
import type { Annotation } from "../../../types";

export interface ScreenshotEditorConfig {
  screenshot: Blob;
  existingAnnotations?: Annotation[];
  onSave: (annotatedScreenshot: Blob, annotations: Annotation[]) => void;
  onCancel: () => void;
}

export const screenshotEditorStyles = `
  .relay-screenshot-editor {
    position: fixed;
    inset: 0;
    z-index: 1000000;
    display: flex;
    flex-direction: column;
    background: hsl(var(--relay-bg));
  }

  .relay-screenshot-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: hsl(var(--relay-bg));
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  .relay-screenshot-editor__title {
    font-size: 16px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
  }

  .relay-screenshot-editor__actions {
    display: flex;
    gap: 8px;
  }

  .relay-screenshot-editor__canvas-container {
    flex: 1;
    position: relative;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(var(--relay-bg-secondary));
    padding: 16px;
  }

  .relay-screenshot-editor__canvas-wrapper {
    position: relative;
    box-shadow: var(--relay-shadow-lg);
    background: white;
  }

  .relay-screenshot-editor__image {
    display: block;
    max-width: 100%;
    max-height: calc(100vh - 180px);
    height: auto;
  }

  /* Animation */
  .relay-screenshot-editor--enter {
    animation: relay-editor-enter 0.3s ease-out;
  }

  .relay-screenshot-editor--exit {
    animation: relay-editor-exit 0.2s ease-in forwards;
  }

  @keyframes relay-editor-enter {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes relay-editor-exit {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
`;

export interface ScreenshotEditorResult {
  element: HTMLDivElement;
  open: () => void;
  close: () => Promise<void>;
}

export function createScreenshotEditor(
  config: ScreenshotEditorConfig,
): ScreenshotEditorResult {
  const { screenshot, existingAnnotations = [], onSave, onCancel } = config;

  let toolbar: AnnotationToolbarResult | null = null;
  let annotationLayer: AnnotationLayerResult | null = null;
  let imageWidth = 0;
  let imageHeight = 0;

  // Create main container
  const editor = createElement("div", {
    class: "relay-screenshot-editor relay-screenshot-editor--enter",
  }) as HTMLDivElement;

  // Create header
  const header = createElement("div", {
    class: "relay-screenshot-editor__header",
  });
  const title = createElement(
    "h3",
    { class: "relay-screenshot-editor__title" },
    ["Edit Screenshot"],
  );

  const actions = createElement("div", {
    class: "relay-screenshot-editor__actions",
  });
  const cancelBtn = createButton("Cancel", {
    variant: "secondary",
    size: "sm",
    onClick: () => close(),
  });
  const saveBtn = createButton("Save", {
    variant: "primary",
    size: "sm",
    onClick: () => handleSave(),
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  header.appendChild(title);
  header.appendChild(actions);

  // Create canvas container
  const canvasContainer = createElement("div", {
    class: "relay-screenshot-editor__canvas-container",
  });
  const canvasWrapper = createElement("div", {
    class: "relay-screenshot-editor__canvas-wrapper",
  });

  // Load screenshot and create annotation layer
  const img = createElement("img", {
    class: "relay-screenshot-editor__image",
  }) as HTMLImageElement;

  const screenshotUrl = URL.createObjectURL(screenshot);
  img.src = screenshotUrl;

  img.onload = () => {
    imageWidth = img.naturalWidth;
    imageHeight = img.naturalHeight;

    // Create toolbar
    toolbar = createAnnotationToolbar({
      activeTool: "arrow",
      activeColor: "#ef4444",
      onToolChange: (tool) => {
        annotationLayer?.setTool(tool);
      },
      onColorChange: (color) => {
        annotationLayer?.setColor(color);
      },
      onUndo: () => {
        annotationLayer?.undo();
        updateUndoRedoState();
      },
      onRedo: () => {
        annotationLayer?.redo();
        updateUndoRedoState();
      },
    });

    // Insert toolbar after header
    editor.insertBefore(toolbar.element, canvasContainer);

    // Create annotation layer
    annotationLayer = createAnnotationLayer({
      width: imageWidth,
      height: imageHeight,
      tool: toolbar.getActiveTool(),
      color: toolbar.getActiveColor(),
      onAnnotationAdd: () => {
        updateUndoRedoState();
      },
    });

    // Set existing annotations if any
    if (existingAnnotations.length > 0) {
      annotationLayer.setAnnotations(existingAnnotations);
    }

    // Position annotation layer over image
    const layerEl = annotationLayer.element;
    layerEl.style.position = "absolute";
    layerEl.style.top = "0";
    layerEl.style.left = "0";
    layerEl.style.width = "100%";
    layerEl.style.height = "100%";

    canvasWrapper.appendChild(layerEl);
    annotationLayer.redraw();
  };

  canvasWrapper.appendChild(img);
  canvasContainer.appendChild(canvasWrapper);

  // Assemble editor
  editor.appendChild(header);
  editor.appendChild(canvasContainer);

  // Update undo/redo button states
  const updateUndoRedoState = () => {
    if (toolbar && annotationLayer) {
      toolbar.setCanUndo(annotationLayer.canUndo());
      toolbar.setCanRedo(annotationLayer.canRedo());
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!annotationLayer) return;

    const annotations = annotationLayer.getAnnotations();

    // Create canvas to combine image and annotations
    const canvas = document.createElement("canvas");
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext("2d")!;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Draw annotations from the annotation layer canvas
    ctx.drawImage(annotationLayer.canvas, 0, 0);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob, annotations);
      }
      close();
    }, "image/png");
  };

  // Close editor
  const close = async () => {
    editor.classList.remove("relay-screenshot-editor--enter");
    editor.classList.add("relay-screenshot-editor--exit");
    await waitForAnimation(editor);
    editor.remove();
    URL.revokeObjectURL(screenshotUrl);
    onCancel();
  };

  // Keyboard shortcuts
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        annotationLayer?.redo();
      } else {
        annotationLayer?.undo();
      }
      updateUndoRedoState();
    } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  document.addEventListener("keydown", handleKeydown);

  // Cleanup on remove
  const cleanup = () => {
    document.removeEventListener("keydown", handleKeydown);
    URL.revokeObjectURL(screenshotUrl);
  };

  return {
    element: editor,
    open: () => {
      document.body.appendChild(editor);
    },
    close: async () => {
      await close();
      cleanup();
    },
  };
}
