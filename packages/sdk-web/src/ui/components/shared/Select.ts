// ============================================================================
// SELECT COMPONENT
// Dropdown select with options
// ============================================================================

import { createElement, generateId } from '../../utils/dom';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  name?: string;
  placeholder?: string;
  value?: string;
  options: SelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

export const selectStyles = `
  #relay-widget .relay-select-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  #relay-widget .relay-select-label {
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-select-label--required::after {
    content: ' *';
    color: hsl(var(--relay-error));
  }

  #relay-widget .relay-select-wrapper {
    position: relative;
  }

  #relay-widget .relay-select {
    width: 100%;
    padding: 10px 36px 10px 14px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 10px;
    cursor: pointer;
    appearance: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  #relay-widget .relay-select:hover:not(:focus):not(:disabled) {
    border-color: hsl(var(--relay-border-hover));
    background: hsl(var(--relay-bg));
  }

  #relay-widget .relay-select:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-select--error {
    border-color: hsl(var(--relay-error));
  }

  #relay-widget .relay-select--error:focus {
    box-shadow: 0 0 0 3px hsl(var(--relay-error) / 0.1);
  }

  #relay-widget .relay-select-icon {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-select-icon svg {
    display: block;
  }

  #relay-widget .relay-select-error {
    font-size: 12px;
    color: hsl(var(--relay-error));
  }
`;

export interface SelectResult {
  container: HTMLDivElement;
  select: HTMLSelectElement;
  setError: (error: string | null) => void;
  setValue: (value: string) => void;
  getValue: () => string;
  setOptions: (options: SelectOption[]) => void;
}

export function createSelect(label: string, props: SelectProps): SelectResult {
  const {
    name,
    placeholder,
    value = '',
    options,
    required = false,
    disabled = false,
    className = '',
    onChange,
  } = props;

  const id = generateId('select');

  // Create container
  const container = createElement('div', { class: `relay-select-group ${className}`.trim() });

  // Create label
  const labelEl = createElement('label', {
    class: `relay-select-label ${required ? 'relay-select-label--required' : ''}`,
    htmlFor: id,
  }, [label]);

  // Create wrapper for icon positioning
  const wrapper = createElement('div', { class: 'relay-select-wrapper' });

  // Create select
  const select = createElement('select', {
    id,
    name: name || id,
    class: 'relay-select',
    required,
    disabled,
  }) as HTMLSelectElement;

  // Add placeholder option
  if (placeholder) {
    const placeholderOption = createElement('option', {
      value: '',
      disabled: true,
      selected: !value,
    }, [placeholder]);
    select.appendChild(placeholderOption);
  }

  // Add options
  const addOptions = (opts: SelectOption[]) => {
    opts.forEach((opt) => {
      const option = createElement('option', {
        value: opt.value,
        disabled: opt.disabled,
        selected: opt.value === value,
      }, [opt.label]);
      select.appendChild(option);
    });
  };

  addOptions(options);

  // Create dropdown icon
  const icon = createElement('span', { class: 'relay-select-icon' });
  icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5L6 7.5L9 4.5"/></svg>`;

  // Create error container
  const errorEl = createElement('span', { class: 'relay-select-error' });
  errorEl.style.display = 'none';

  // Assemble
  wrapper.appendChild(select);
  wrapper.appendChild(icon);
  container.appendChild(labelEl);
  container.appendChild(wrapper);
  container.appendChild(errorEl);

  // Event handlers
  if (onChange) {
    select.addEventListener('change', () => onChange(select.value));
  }

  return {
    container,
    select,
    setError: (error: string | null) => {
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
        select.classList.add('relay-select--error');
      } else {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
        select.classList.remove('relay-select--error');
      }
    },
    setValue: (newValue: string) => {
      select.value = newValue;
    },
    getValue: () => select.value,
    setOptions: (newOptions: SelectOption[]) => {
      // Remove all options except placeholder
      const existingValue = select.value;
      select.innerHTML = '';
      if (placeholder) {
        const placeholderOption = createElement('option', {
          value: '',
          disabled: true,
        }, [placeholder]);
        select.appendChild(placeholderOption);
      }
      addOptions(newOptions);
      // Try to restore previous value
      if (newOptions.some(o => o.value === existingValue)) {
        select.value = existingValue;
      }
    },
  };
}
