// ============================================================================
// TRIGGER COMPONENT
// Floating button to open the widget
// ============================================================================

import { createElement, setStyles } from "../utils/dom";
import {
  getPositionStyles,
  onBreakpointChange,
  type Breakpoint,
} from "../utils/responsive";

export interface TriggerConfig {
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  primaryColor?: string;
  icon?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

export const triggerStyles = `
  #relay-widget .relay-trigger {
    position: fixed;
    z-index: 999998;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: hsl(var(--relay-primary));
    border: none;
    cursor: pointer;
    box-shadow:
      0 2px 8px hsl(var(--relay-primary) / 0.25),
      0 4px 16px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
  }

  #relay-widget .relay-trigger:hover {
    transform: scale(1.05);
    background: hsl(var(--relay-primary-hover));
    box-shadow:
      0 4px 12px hsl(var(--relay-primary) / 0.3),
      0 8px 24px rgba(0, 0, 0, 0.15);
  }

  #relay-widget .relay-trigger:active {
    transform: scale(0.95);
  }

  #relay-widget .relay-trigger:focus-visible {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 4px;
  }

  #relay-widget .relay-trigger__icon {
    width: 26px;
    height: 26px;
    color: hsl(var(--relay-primary-text));
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  #relay-widget .relay-trigger__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-trigger--open .relay-trigger__icon {
    transform: rotate(45deg);
  }

  #relay-widget .relay-trigger__badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: hsl(var(--relay-error));
    color: white;
    font-size: 11px;
    font-weight: 700;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid hsl(var(--relay-bg));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 480px) {
    #relay-widget .relay-trigger {
      width: 56px;
      height: 56px;
    }

    #relay-widget .relay-trigger__icon {
      width: 24px;
      height: 24px;
    }
  }
`;

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export interface TriggerResult {
  element: HTMLButtonElement;
  setOpen: (open: boolean) => void;
  setBadge: (count: number | null) => void;
  updatePosition: (position: TriggerConfig["position"]) => void;
  destroy: () => void;
}

export function createTrigger(config: TriggerConfig): TriggerResult {
  const {
    position,
    icon = DEFAULT_ICON,
    ariaLabel = "Open feedback widget",
    onClick,
  } = config;

  // Create button
  const button = createElement("button", {
    type: "button",
    class: "relay-trigger",
  }) as HTMLButtonElement;
  button.setAttribute("aria-label", ariaLabel);

  // Create icon container
  const iconEl = createElement("span", { class: "relay-trigger__icon" });
  iconEl.innerHTML = icon;
  button.appendChild(iconEl);

  // Create badge (hidden by default)
  const badge = createElement("span", { class: "relay-trigger__badge" });
  badge.style.display = "none";
  button.appendChild(badge);

  // Apply initial position
  const applyPosition = (
    pos: TriggerConfig["position"],
    breakpoint?: Breakpoint,
  ) => {
    const styles = getPositionStyles(pos, breakpoint);
    // Reset all position properties
    button.style.top = "";
    button.style.right = "";
    button.style.bottom = "";
    button.style.left = "";
    // Apply new position
    setStyles(button, styles.trigger as any);
  };

  applyPosition(position);

  // Listen for breakpoint changes
  const removeBreakpointListener = onBreakpointChange((breakpoint) => {
    applyPosition(position, breakpoint);
  });

  // Click handler
  if (onClick) {
    button.addEventListener("click", onClick);
  }

  let isOpen = false;

  return {
    element: button,
    setOpen: (open: boolean) => {
      isOpen = open;
      button.classList.toggle("relay-trigger--open", open);
      iconEl.innerHTML = open ? CLOSE_ICON : icon;
      button.setAttribute(
        "aria-label",
        open ? "Close feedback widget" : ariaLabel,
      );
    },
    setBadge: (count: number | null) => {
      if (count && count > 0) {
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    },
    updatePosition: (newPosition: TriggerConfig["position"]) => {
      applyPosition(newPosition);
    },
    destroy: () => {
      removeBreakpointListener();
      button.remove();
    },
  };
}
