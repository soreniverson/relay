// ============================================================================
// ANNOTATION TOOLBAR COMPONENT
// Tools for annotating screenshots
// ============================================================================

import { createElement } from "../../utils/dom";

export type AnnotationTool =
  | "arrow"
  | "rectangle"
  | "circle"
  | "highlight"
  | "blur"
  | "text";

export interface AnnotationToolbarConfig {
  activeTool?: AnnotationTool;
  activeColor?: string;
  onToolChange?: (tool: AnnotationTool) => void;
  onColorChange?: (color: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const annotationToolbarStyles = `
  .relay-annotation-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: hsl(var(--relay-bg));
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  .relay-annotation-toolbar__tools {
    display: flex;
    gap: 4px;
  }

  .relay-annotation-toolbar__tool {
    width: 36px;
    height: 36px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-annotation-toolbar__tool:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  .relay-annotation-toolbar__tool--active {
    background: hsl(var(--relay-bg-tertiary));
    color: hsl(var(--relay-primary));
  }

  .relay-annotation-toolbar__tool svg {
    width: 20px;
    height: 20px;
  }

  .relay-annotation-toolbar__divider {
    width: 1px;
    height: 24px;
    background: hsl(var(--relay-border));
    margin: 0 4px;
  }

  .relay-annotation-toolbar__colors {
    display: flex;
    gap: 4px;
  }

  .relay-annotation-toolbar__color {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-annotation-toolbar__color:hover {
    transform: scale(1.1);
  }

  .relay-annotation-toolbar__color--active {
    border-color: hsl(var(--relay-text));
    box-shadow: 0 0 0 2px hsl(var(--relay-bg));
  }

  .relay-annotation-toolbar__actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .relay-annotation-toolbar__action {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-annotation-toolbar__action:hover:not(:disabled) {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  .relay-annotation-toolbar__action:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .relay-annotation-toolbar__action svg {
    width: 18px;
    height: 18px;
  }
`;

const TOOL_ICONS: Record<AnnotationTool, string> = {
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  rectangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
  circle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`,
  highlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  blur: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
};

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#000000", // black
];

export interface AnnotationToolbarResult {
  element: HTMLElement;
  setActiveTool: (tool: AnnotationTool) => void;
  setActiveColor: (color: string) => void;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
  getActiveTool: () => AnnotationTool;
  getActiveColor: () => string;
}

export function createAnnotationToolbar(
  config: AnnotationToolbarConfig = {},
): AnnotationToolbarResult {
  const {
    activeTool = "arrow",
    activeColor = COLORS[0],
    onToolChange,
    onColorChange,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
  } = config;

  let currentTool: AnnotationTool = activeTool;
  let currentColor: string = activeColor;

  // Create container
  const toolbar = createElement("div", { class: "relay-annotation-toolbar" });

  // Tools section
  const toolsContainer = createElement("div", {
    class: "relay-annotation-toolbar__tools",
  });
  const toolButtons = new Map<AnnotationTool, HTMLButtonElement>();

  (Object.keys(TOOL_ICONS) as AnnotationTool[]).forEach((tool) => {
    const btn = createElement("button", {
      type: "button",
      class: `relay-annotation-toolbar__tool ${tool === currentTool ? "relay-annotation-toolbar__tool--active" : ""}`,
    }) as HTMLButtonElement;
    btn.innerHTML = TOOL_ICONS[tool];
    btn.setAttribute("aria-label", `${tool} tool`);
    btn.setAttribute("title", tool.charAt(0).toUpperCase() + tool.slice(1));

    btn.addEventListener("click", () => {
      setActiveTool(tool);
      onToolChange?.(tool);
    });

    toolButtons.set(tool, btn);
    toolsContainer.appendChild(btn);
  });

  // Divider
  const divider1 = createElement("div", {
    class: "relay-annotation-toolbar__divider",
  });

  // Colors section
  const colorsContainer = createElement("div", {
    class: "relay-annotation-toolbar__colors",
  });
  const colorButtons = new Map<string, HTMLButtonElement>();

  COLORS.forEach((color) => {
    const btn = createElement("button", {
      type: "button",
      class: `relay-annotation-toolbar__color ${color === currentColor ? "relay-annotation-toolbar__color--active" : ""}`,
    }) as HTMLButtonElement;
    btn.style.backgroundColor = color;
    btn.setAttribute("aria-label", `Color ${color}`);

    btn.addEventListener("click", () => {
      setActiveColor(color);
      onColorChange?.(color);
    });

    colorButtons.set(color, btn);
    colorsContainer.appendChild(btn);
  });

  // Divider
  const divider2 = createElement("div", {
    class: "relay-annotation-toolbar__divider",
  });

  // Actions section
  const actionsContainer = createElement("div", {
    class: "relay-annotation-toolbar__actions",
  });

  const undoBtn = createElement("button", {
    type: "button",
    class: "relay-annotation-toolbar__action",
    disabled: !canUndo,
  }) as HTMLButtonElement;
  undoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6M3 13l4-4c1.33-1.33 3.17-2 5-2s3.67.67 5 2c1.33 1.33 2 3.17 2 5s-.67 3.67-2 5"/></svg>`;
  undoBtn.setAttribute("aria-label", "Undo");
  undoBtn.setAttribute("title", "Undo (Ctrl+Z)");
  if (onUndo) {
    undoBtn.addEventListener("click", onUndo);
  }

  const redoBtn = createElement("button", {
    type: "button",
    class: "relay-annotation-toolbar__action",
    disabled: !canRedo,
  }) as HTMLButtonElement;
  redoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6M21 13l-4-4c-1.33-1.33-3.17-2-5-2s-3.67.67-5 2c-1.33 1.33-2 3.17-2 5s.67 3.67 2 5"/></svg>`;
  redoBtn.setAttribute("aria-label", "Redo");
  redoBtn.setAttribute("title", "Redo (Ctrl+Shift+Z)");
  if (onRedo) {
    redoBtn.addEventListener("click", onRedo);
  }

  actionsContainer.appendChild(undoBtn);
  actionsContainer.appendChild(redoBtn);

  // Assemble
  toolbar.appendChild(toolsContainer);
  toolbar.appendChild(divider1);
  toolbar.appendChild(colorsContainer);
  toolbar.appendChild(divider2);
  toolbar.appendChild(actionsContainer);

  // Helper functions
  const setActiveTool = (tool: AnnotationTool) => {
    toolButtons
      .get(currentTool)
      ?.classList.remove("relay-annotation-toolbar__tool--active");
    toolButtons
      .get(tool)
      ?.classList.add("relay-annotation-toolbar__tool--active");
    currentTool = tool;
  };

  const setActiveColor = (color: string) => {
    colorButtons
      .get(currentColor)
      ?.classList.remove("relay-annotation-toolbar__color--active");
    colorButtons
      .get(color)
      ?.classList.add("relay-annotation-toolbar__color--active");
    currentColor = color;
  };

  return {
    element: toolbar,
    setActiveTool,
    setActiveColor,
    setCanUndo: (value: boolean) => {
      undoBtn.disabled = !value;
    },
    setCanRedo: (value: boolean) => {
      redoBtn.disabled = !value;
    },
    getActiveTool: () => currentTool,
    getActiveColor: () => currentColor,
  };
}
