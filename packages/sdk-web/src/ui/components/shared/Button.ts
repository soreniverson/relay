// ============================================================================
// BUTTON COMPONENT
// Reusable button with variants and states
// ============================================================================

import { createElement, generateId } from "../../utils/dom";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  onClick?: (e: MouseEvent) => void;
}

export const buttonStyles = `
  /* Button base - matches dashboard design system */
  #relay-widget .relay-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: inherit;
    font-weight: 500;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  #relay-widget .relay-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  #relay-widget .relay-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  #relay-widget .relay-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--relay-bg)), 0 0 0 4px hsl(var(--relay-border-focus));
  }

  /* Sizes - 32px sm, 36px md, 40px lg */
  #relay-widget .relay-btn--sm {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
    border-radius: 6px;
  }

  #relay-widget .relay-btn--md {
    height: 36px;
    padding: 0 16px;
    font-size: 14px;
  }

  #relay-widget .relay-btn--lg {
    height: 40px;
    padding: 0 20px;
    font-size: 14px;
    border-radius: 10px;
  }

  /* Primary variant */
  #relay-widget .relay-btn--primary {
    background: hsl(var(--relay-primary));
    color: hsl(var(--relay-primary-text));
    border-color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-btn--primary:hover:not(:disabled) {
    background: hsl(var(--relay-primary-hover));
    border-color: hsl(var(--relay-primary-hover));
  }

  /* Secondary/default variant - transparent with border */
  #relay-widget .relay-btn--secondary {
    background: transparent;
    color: hsl(var(--relay-text));
    border-color: hsl(var(--relay-border));
  }

  #relay-widget .relay-btn--secondary:hover:not(:disabled) {
    background: hsl(var(--relay-bg-tertiary));
    border-color: hsl(var(--relay-border-hover));
  }

  /* Ghost variant */
  #relay-widget .relay-btn--ghost {
    background: transparent;
    color: hsl(var(--relay-text-secondary));
    border-color: transparent;
  }

  #relay-widget .relay-btn--ghost:hover:not(:disabled) {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  /* Danger/destructive variant */
  #relay-widget .relay-btn--danger {
    background: transparent;
    color: hsl(var(--relay-error));
    border-color: hsl(var(--relay-error) / 0.3);
  }

  #relay-widget .relay-btn--danger:hover:not(:disabled) {
    background: hsl(var(--relay-error) / 0.1);
    border-color: hsl(var(--relay-error) / 0.5);
  }

  /* Full width */
  #relay-widget .relay-btn--full {
    width: 100%;
  }

  /* Loading spinner */
  #relay-widget .relay-btn__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: relay-spin 0.6s linear infinite;
  }

  #relay-widget .relay-btn--sm .relay-btn__spinner {
    width: 12px;
    height: 12px;
  }

  #relay-widget .relay-btn--lg .relay-btn__spinner {
    width: 16px;
    height: 16px;
  }
`;

export function createButton(
  label: string | HTMLElement,
  props: ButtonProps = {},
): HTMLButtonElement {
  const {
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    fullWidth = false,
    type = "button",
    className = "",
    onClick,
  } = props;

  const classes = [
    "relay-btn",
    `relay-btn--${variant}`,
    `relay-btn--${size}`,
    fullWidth ? "relay-btn--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const button = createElement("button", {
    type,
    class: classes,
    disabled: disabled || loading,
  });

  if (loading) {
    button.appendChild(createElement("span", { class: "relay-btn__spinner" }));
  }

  if (typeof label === "string") {
    button.appendChild(document.createTextNode(label));
  } else {
    button.appendChild(label);
  }

  if (onClick) {
    button.addEventListener("click", onClick);
  }

  return button;
}

/**
 * Updates button loading state
 */
export function setButtonLoading(
  button: HTMLButtonElement,
  loading: boolean,
  loadingText?: string,
): void {
  const originalText = button.dataset.originalText || button.textContent || "";

  if (loading) {
    button.dataset.originalText = originalText;
    button.disabled = true;
    button.innerHTML = "";
    button.appendChild(createElement("span", { class: "relay-btn__spinner" }));
    button.appendChild(document.createTextNode(loadingText || "Loading..."));
  } else {
    button.disabled = false;
    button.innerHTML = "";
    button.appendChild(
      document.createTextNode(button.dataset.originalText || originalText),
    );
    delete button.dataset.originalText;
  }
}

/**
 * Creates an icon button
 */
export function createIconButton(
  icon: string | HTMLElement,
  props: ButtonProps & { ariaLabel: string },
): HTMLButtonElement {
  const button = createButton(icon, {
    ...props,
    variant: props.variant || "ghost",
  });
  button.setAttribute("aria-label", props.ariaLabel);
  button.style.padding =
    props.size === "sm" ? "6px" : props.size === "lg" ? "12px" : "8px";
  return button;
}
