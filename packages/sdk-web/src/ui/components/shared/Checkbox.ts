// ============================================================================
// CHECKBOX COMPONENT
// Checkbox with label
// ============================================================================

import { createElement, generateId } from "../../utils/dom";

export interface CheckboxProps {
  name?: string;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (checked: boolean) => void;
}

export const checkboxStyles = `
  #relay-widget .relay-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    user-select: none;
  }

  #relay-widget .relay-checkbox--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  #relay-widget .relay-checkbox__input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  #relay-widget .relay-checkbox__box {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border: 1.5px solid hsl(var(--relay-border-hover));
    border-radius: 5px;
    background: hsl(var(--relay-bg));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-checkbox:hover .relay-checkbox__box {
    border-color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-checkbox__input:focus-visible + .relay-checkbox__box {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 2px;
  }

  #relay-widget .relay-checkbox__input:checked + .relay-checkbox__box {
    background: hsl(var(--relay-primary));
    border-color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-checkbox__icon {
    width: 12px;
    height: 12px;
    color: hsl(var(--relay-primary-text));
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.15s ease;
  }

  #relay-widget .relay-checkbox__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-checkbox__input:checked + .relay-checkbox__box .relay-checkbox__icon {
    opacity: 1;
    transform: scale(1);
  }

  #relay-widget .relay-checkbox__content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  #relay-widget .relay-checkbox__label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    line-height: 1.4;
  }

  #relay-widget .relay-checkbox__description {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
    line-height: 1.4;
  }
`;

export interface CheckboxResult {
  container: HTMLLabelElement;
  input: HTMLInputElement;
  setChecked: (checked: boolean) => void;
  isChecked: () => boolean;
}

export function createCheckbox(
  label: string,
  props: CheckboxProps = {},
  description?: string,
): CheckboxResult {
  const {
    name,
    checked = false,
    disabled = false,
    className = "",
    onChange,
  } = props;

  const id = generateId("checkbox");

  // Create container label
  const container = createElement("label", {
    class:
      `relay-checkbox ${disabled ? "relay-checkbox--disabled" : ""} ${className}`.trim(),
    htmlFor: id,
  }) as HTMLLabelElement;

  // Create hidden input
  const input = createElement("input", {
    type: "checkbox",
    id,
    name: name || id,
    class: "relay-checkbox__input",
    checked,
    disabled,
  }) as HTMLInputElement;

  // Create custom checkbox box
  const box = createElement("span", { class: "relay-checkbox__box" });

  // Checkmark icon
  const icon = createElement("span", { class: "relay-checkbox__icon" });
  icon.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l3 3 5-6"/></svg>`;
  box.appendChild(icon);

  // Create label text
  const labelWrapper = createElement("div", {
    class: "relay-checkbox__content",
  });
  const labelText = createElement("span", { class: "relay-checkbox__label" }, [
    label,
  ]);
  labelWrapper.appendChild(labelText);

  if (description) {
    const descEl = createElement(
      "span",
      { class: "relay-checkbox__description" },
      [description],
    );
    labelWrapper.appendChild(descEl);
  }

  // Assemble
  container.appendChild(input);
  container.appendChild(box);
  container.appendChild(labelWrapper);

  // Event handler
  if (onChange) {
    input.addEventListener("change", () => onChange(input.checked));
  }

  return {
    container,
    input,
    setChecked: (newChecked: boolean) => {
      input.checked = newChecked;
    },
    isChecked: () => input.checked,
  };
}
