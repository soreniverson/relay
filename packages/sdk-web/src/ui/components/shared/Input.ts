// ============================================================================
// INPUT COMPONENT
// Text input with label and validation
// ============================================================================

import { createElement, generateId } from "../../utils/dom";

export interface InputProps {
  type?: "text" | "email" | "password" | "url" | "search";
  name?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  pattern?: string;
  autoFocus?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
}

export const inputStyles = `
  #relay-widget .relay-input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #relay-widget .relay-input-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-input-label--required::after {
    content: ' *';
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-input {
    width: 100%;
    padding: 10px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  #relay-widget .relay-input::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-input:hover:not(:focus):not(:disabled) {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg));
  }

  #relay-widget .relay-input:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-input--error {
    border-color: hsl(var(--relay-error));
  }

  #relay-widget .relay-input--error:focus {
    box-shadow: 0 0 0 3px hsl(var(--relay-error) / 0.1);
  }

  #relay-widget .relay-input-error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-input-hint {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }
`;

export interface InputResult {
  container: HTMLDivElement;
  input: HTMLInputElement;
  setError: (error: string | null) => void;
  setValue: (value: string) => void;
  getValue: () => string;
}

export function createInput(
  label: string,
  props: InputProps = {},
): InputResult {
  const {
    type = "text",
    name,
    placeholder,
    value = "",
    required = false,
    disabled = false,
    maxLength,
    pattern,
    autoFocus = false,
    className = "",
    onChange,
    onBlur,
  } = props;

  const id = generateId("input");

  // Create container
  const container = createElement("div", {
    class: `relay-input-group ${className}`.trim(),
  });

  // Create label
  const labelEl = createElement(
    "label",
    {
      class: `relay-input-label ${required ? "relay-input-label--required" : ""}`,
      htmlFor: id,
    },
    [label],
  );

  // Create input
  const input = createElement("input", {
    id,
    type,
    name: name || id,
    class: "relay-input",
    placeholder,
    value,
    required,
    disabled,
    maxLength: maxLength as any,
    pattern,
    autofocus: autoFocus,
  }) as HTMLInputElement;

  // Create error container
  const errorEl = createElement("span", { class: "relay-input-error" });
  errorEl.style.display = "none";

  // Assemble
  container.appendChild(labelEl);
  container.appendChild(input);
  container.appendChild(errorEl);

  // Event handlers
  if (onChange) {
    input.addEventListener("input", () => onChange(input.value));
  }

  if (onBlur) {
    input.addEventListener("blur", () => onBlur(input.value));
  }

  return {
    container,
    input,
    setError: (error: string | null) => {
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = "block";
        input.classList.add("relay-input--error");
      } else {
        errorEl.textContent = "";
        errorEl.style.display = "none";
        input.classList.remove("relay-input--error");
      }
    },
    setValue: (newValue: string) => {
      input.value = newValue;
    },
    getValue: () => input.value,
  };
}
