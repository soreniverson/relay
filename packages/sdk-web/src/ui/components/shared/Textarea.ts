// ============================================================================
// TEXTAREA COMPONENT
// Multi-line text input with label and validation
// ============================================================================

import { createElement, generateId } from "../../utils/dom";

export interface TextareaProps {
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  autoResize?: boolean;
  autoFocus?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
}

export const textareaStyles = `
  #relay-widget .relay-textarea-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #relay-widget .relay-textarea-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-textarea-label--required::after {
    content: ' *';
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-textarea {
    width: 100%;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    resize: vertical;
    min-height: 100px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  #relay-widget .relay-textarea::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-textarea:hover:not(:focus):not(:disabled) {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg));
  }

  #relay-widget .relay-textarea:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-textarea--error {
    border-color: hsl(var(--relay-error));
  }

  #relay-widget .relay-textarea--error:focus {
    box-shadow: 0 0 0 3px hsl(var(--relay-error) / 0.1);
  }

  #relay-widget .relay-textarea--auto-resize {
    resize: none;
    overflow: hidden;
  }

  #relay-widget .relay-textarea-error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-textarea-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: -4px;
  }

  #relay-widget .relay-textarea-counter {
    font-size: 11px;
    color: hsl(var(--relay-text-subtle));
    margin-left: auto;
  }

  #relay-widget .relay-textarea-counter--warning {
    color: hsl(var(--relay-warning));
  }

  #relay-widget .relay-textarea-counter--error {
    color: hsl(var(--relay-error));
  }
`;

export interface TextareaResult {
  container: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  setError: (error: string | null) => void;
  setValue: (value: string) => void;
  getValue: () => string;
}

export function createTextarea(
  label: string,
  props: TextareaProps = {},
): TextareaResult {
  const {
    name,
    placeholder,
    value = "",
    required = false,
    disabled = false,
    maxLength,
    rows = 4,
    autoResize = false,
    autoFocus = false,
    className = "",
    onChange,
    onBlur,
  } = props;

  const id = generateId("textarea");

  // Create container
  const container = createElement("div", {
    class: `relay-textarea-group ${className}`.trim(),
  });

  // Create label
  const labelEl = createElement(
    "label",
    {
      class: `relay-textarea-label ${required ? "relay-textarea-label--required" : ""}`,
      htmlFor: id,
    },
    [label],
  );

  // Create textarea
  const textarea = createElement("textarea", {
    id,
    name: name || id,
    class: `relay-textarea ${autoResize ? "relay-textarea--auto-resize" : ""}`,
    placeholder,
    required,
    disabled,
    rows,
    autofocus: autoFocus,
  }) as HTMLTextAreaElement;

  textarea.value = value;
  if (maxLength) {
    textarea.maxLength = maxLength;
  }

  // Create footer
  const footer = createElement("div", { class: "relay-textarea-footer" });
  const errorEl = createElement("span", { class: "relay-textarea-error" });
  errorEl.style.display = "none";

  let counterEl: HTMLSpanElement | null = null;
  if (maxLength) {
    counterEl = createElement("span", { class: "relay-textarea-counter" });
    counterEl.textContent = `${value.length}/${maxLength}`;
  }

  footer.appendChild(errorEl);
  if (counterEl) {
    footer.appendChild(counterEl);
  }

  // Assemble
  container.appendChild(labelEl);
  container.appendChild(textarea);
  container.appendChild(footer);

  // Auto-resize handler
  const adjustHeight = () => {
    if (autoResize) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Update counter
  const updateCounter = () => {
    if (counterEl && maxLength) {
      const remaining = maxLength - textarea.value.length;
      counterEl.textContent = `${textarea.value.length}/${maxLength}`;
      counterEl.classList.remove(
        "relay-textarea-counter--warning",
        "relay-textarea-counter--error",
      );
      if (remaining <= 0) {
        counterEl.classList.add("relay-textarea-counter--error");
      } else if (remaining <= maxLength * 0.1) {
        counterEl.classList.add("relay-textarea-counter--warning");
      }
    }
  };

  // Event handlers
  textarea.addEventListener("input", () => {
    adjustHeight();
    updateCounter();
    if (onChange) {
      onChange(textarea.value);
    }
  });

  if (onBlur) {
    textarea.addEventListener("blur", () => onBlur(textarea.value));
  }

  // Initial adjustments
  adjustHeight();
  updateCounter();

  return {
    container,
    textarea,
    setError: (error: string | null) => {
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = "block";
        textarea.classList.add("relay-textarea--error");
      } else {
        errorEl.textContent = "";
        errorEl.style.display = "none";
        textarea.classList.remove("relay-textarea--error");
      }
    },
    setValue: (newValue: string) => {
      textarea.value = newValue;
      adjustHeight();
      updateCounter();
    },
    getValue: () => textarea.value,
  };
}
