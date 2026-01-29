// ============================================================================
// RESPONSIVE UTILITIES
// Breakpoint detection and responsive helpers
// ============================================================================

export type Breakpoint = "mobile" | "desktop";

export const BREAKPOINTS = {
  mobile: 480,
} as const;

/**
 * Gets the current breakpoint based on window width
 */
export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth <= BREAKPOINTS.mobile ? "mobile" : "desktop";
}

/**
 * Checks if we're on mobile
 */
export function isMobile(): boolean {
  return getCurrentBreakpoint() === "mobile";
}

/**
 * Checks if we're on desktop
 */
export function isDesktop(): boolean {
  return getCurrentBreakpoint() === "desktop";
}

/**
 * Creates a responsive listener that fires when breakpoint changes
 */
export function onBreakpointChange(
  callback: (breakpoint: Breakpoint) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  let currentBreakpoint = getCurrentBreakpoint();

  const handleResize = () => {
    const newBreakpoint = getCurrentBreakpoint();
    if (newBreakpoint !== currentBreakpoint) {
      currentBreakpoint = newBreakpoint;
      callback(newBreakpoint);
    }
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}

/**
 * Gets position config based on widget position and breakpoint
 */
export function getPositionStyles(
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left",
  breakpoint: Breakpoint = getCurrentBreakpoint(),
): {
  trigger: Record<string, string>;
  modal: Record<string, string>;
} {
  // Mobile always shows as bottom sheet
  if (breakpoint === "mobile") {
    return {
      trigger: {
        position: "fixed",
        bottom: "16px",
        right: position.includes("right") ? "16px" : "auto",
        left: position.includes("left") ? "16px" : "auto",
      },
      modal: {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        top: "auto",
      },
    };
  }

  // Desktop positions
  const isBottom = position.includes("bottom");
  const isRight = position.includes("right");
  const offset = "20px";
  const modalOffset = "90px"; // Space for trigger button

  return {
    trigger: {
      position: "fixed",
      [isBottom ? "bottom" : "top"]: offset,
      [isRight ? "right" : "left"]: offset,
    },
    modal: {
      position: "fixed",
      [isBottom ? "bottom" : "top"]: modalOffset,
      [isRight ? "right" : "left"]: offset,
    },
  };
}

/**
 * Checks if touch is the primary input method
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/**
 * Gets safe area insets (for notched devices)
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (
    typeof window === "undefined" ||
    !CSS.supports("padding-top: env(safe-area-inset-top)")
  ) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const div = document.createElement("div");
  div.style.cssText = `
    position: fixed;
    top: env(safe-area-inset-top);
    right: env(safe-area-inset-right);
    bottom: env(safe-area-inset-bottom);
    left: env(safe-area-inset-left);
    pointer-events: none;
    visibility: hidden;
  `;
  document.body.appendChild(div);

  const rect = div.getBoundingClientRect();
  const insets = {
    top: rect.top,
    right: window.innerWidth - rect.right,
    bottom: window.innerHeight - rect.bottom,
    left: rect.left,
  };

  document.body.removeChild(div);
  return insets;
}
