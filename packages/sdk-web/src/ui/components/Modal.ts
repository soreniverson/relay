// ============================================================================
// MODAL COMPONENT
// Container with animations for the widget content
// ============================================================================

import { createElement, setStyles, waitForAnimation } from "../utils/dom";
import {
  getPositionStyles,
  onBreakpointChange,
  getCurrentBreakpoint,
  type Breakpoint,
} from "../utils/responsive";

export interface ModalConfig {
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  onClose?: () => void;
}

export const modalStyles = `
  #relay-widget .relay-modal {
    position: fixed;
    z-index: 999999;
    width: 400px;
    max-width: 400px;
    height: 700px;
    max-height: min(700px, calc(100vh - 120px));
    background: hsl(var(--relay-bg));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 16px;
    box-shadow:
      0 0 0 1px hsl(var(--relay-border) / 0.1),
      0 4px 6px -1px rgba(0, 0, 0, 0.08),
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 20px 25px -5px rgba(0, 0, 0, 0.1);
    display: none;
    flex-direction: column;
    overflow: hidden;
    right: 24px;
    bottom: 96px;
  }

  #relay-widget .relay-modal--open {
    display: flex;
    animation: relay-modal-enter 0.2s ease-out forwards;
  }

  #relay-widget .relay-modal--closing {
    animation: relay-modal-exit 0.15s ease-in forwards;
  }

  @keyframes relay-modal-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes relay-modal-exit {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  #relay-widget .relay-modal__content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Mobile styles */
  @media (max-width: 480px) {
    #relay-widget .relay-modal {
      width: 100%;
      max-width: 100%;
      max-height: 90vh;
      max-height: 90dvh;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      top: auto !important;
      border-radius: 20px 20px 0 0;
      border-bottom: none;
    }

    #relay-widget .relay-modal--open {
      animation: relay-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #relay-widget .relay-modal--closing {
      animation: relay-modal-slide-down 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
    }

    @keyframes relay-modal-slide-down {
      from {
        transform: translateY(0);
      }
      to {
        transform: translateY(100%);
      }
    }

    /* Drag handle for mobile */
    #relay-widget .relay-modal::before {
      content: '';
      display: block;
      width: 36px;
      height: 5px;
      background: hsl(var(--relay-border));
      border-radius: 3px;
      margin: 10px auto 6px;
      flex-shrink: 0;
    }
  }

  /* Overlay for mobile */
  #relay-widget .relay-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 999998;
    background: var(--relay-overlay);
    opacity: 0;
    transition: opacity 0.25s ease;
    display: none;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  #relay-widget .relay-modal-overlay--visible {
    display: block;
    opacity: 1;
  }

  #relay-widget .relay-modal-overlay--hiding {
    opacity: 0;
  }
`;

export interface ModalResult {
  element: HTMLDivElement;
  overlay: HTMLDivElement;
  contentEl: HTMLDivElement;
  open: () => void;
  close: () => Promise<void>;
  isOpen: () => boolean;
  setContent: (content: HTMLElement | HTMLElement[]) => void;
  updatePosition: (position: ModalConfig["position"]) => void;
  destroy: () => void;
}

export function createModal(config: ModalConfig): ModalResult {
  const { position, onClose } = config;
  let open = false;
  let closing = false;

  // Create overlay (for mobile)
  const overlay = createElement("div", { class: "relay-modal-overlay" });

  // Create modal container
  const modal = createElement("div", {
    class: "relay-modal",
  }) as HTMLDivElement;

  // Create content container
  const contentEl = createElement("div", {
    class: "relay-modal__content",
  }) as HTMLDivElement;
  modal.appendChild(contentEl);

  // Apply initial position
  const applyPosition = (
    pos: ModalConfig["position"],
    breakpoint?: Breakpoint,
  ) => {
    const bp = breakpoint || getCurrentBreakpoint();
    const styles = getPositionStyles(pos, bp);

    // Reset all position properties
    modal.style.top = "";
    modal.style.right = "";
    modal.style.bottom = "";
    modal.style.left = "";

    // Only apply desktop positioning (mobile is handled by CSS)
    if (bp === "desktop") {
      setStyles(modal, styles.modal as any);
    }
  };

  applyPosition(position);

  // Listen for breakpoint changes
  const removeBreakpointListener = onBreakpointChange((breakpoint) => {
    applyPosition(position, breakpoint);
  });

  // Overlay click handler
  overlay.addEventListener("click", () => {
    if (open && !closing) {
      closeModal();
    }
  });

  // Close on escape key
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open && !closing) {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleKeydown);

  const openModal = () => {
    if (open) return;
    open = true;
    modal.classList.add("relay-modal--open");
    modal.classList.remove("relay-modal--closing");

    // Show overlay on mobile
    if (getCurrentBreakpoint() === "mobile") {
      overlay.classList.add("relay-modal-overlay--visible");
      overlay.classList.remove("relay-modal-overlay--hiding");
    }

    // Focus management
    const firstFocusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  };

  const closeModal = async () => {
    if (!open || closing) return;
    closing = true;

    modal.classList.add("relay-modal--closing");

    if (getCurrentBreakpoint() === "mobile") {
      overlay.classList.add("relay-modal-overlay--hiding");
    }

    await waitForAnimation(modal);

    modal.classList.remove("relay-modal--open", "relay-modal--closing");
    overlay.classList.remove(
      "relay-modal-overlay--visible",
      "relay-modal-overlay--hiding",
    );

    open = false;
    closing = false;
    onClose?.();
  };

  return {
    element: modal,
    overlay,
    contentEl,
    open: openModal,
    close: closeModal,
    isOpen: () => open,
    setContent: (content: HTMLElement | HTMLElement[]) => {
      contentEl.innerHTML = "";
      if (Array.isArray(content)) {
        content.forEach((el) => contentEl.appendChild(el));
      } else {
        contentEl.appendChild(content);
      }
    },
    updatePosition: (newPosition: ModalConfig["position"]) => {
      applyPosition(newPosition);
    },
    destroy: () => {
      removeBreakpointListener();
      document.removeEventListener("keydown", handleKeydown);
      modal.remove();
      overlay.remove();
    },
  };
}
