// ============================================================================
// HEADER COMPONENT
// Widget header with title, back button, and close button
// ============================================================================

import { createElement } from '../utils/dom';
import { createIconButton } from './shared/Button';

export interface HeaderConfig {
  title: string;
  showBack?: boolean;
  showClose?: boolean;
  onBack?: () => void;
  onClose?: () => void;
}

export const headerStyles = `
  .relay-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid hsl(var(--relay-border));
    background: hsl(var(--relay-bg));
    min-height: 60px;
    flex-shrink: 0;
  }

  .relay-header__back {
    flex-shrink: 0;
  }

  .relay-header__title {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .relay-header__close {
    flex-shrink: 0;
    margin-right: -4px;
  }

  .relay-header__btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .relay-header__btn:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  .relay-header__btn:active {
    transform: scale(0.95);
  }

  .relay-header__btn:focus-visible {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 2px;
  }

  .relay-header__btn svg {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }
`;

const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export interface HeaderResult {
  element: HTMLElement;
  setTitle: (title: string) => void;
  setShowBack: (show: boolean) => void;
}

export function createHeader(config: HeaderConfig): HeaderResult {
  const { title, showBack = false, showClose = true, onBack, onClose } = config;

  // Create header container
  const header = createElement('header', { class: 'relay-header' });

  // Create back button
  const backBtn = createElement('button', {
    type: 'button',
    class: 'relay-header__btn relay-header__back',
  });
  backBtn.innerHTML = BACK_ICON;
  backBtn.setAttribute('aria-label', 'Go back');
  backBtn.style.display = showBack ? 'flex' : 'none';
  if (onBack) {
    backBtn.addEventListener('click', onBack);
  }

  // Create title
  const titleEl = createElement('h3', { class: 'relay-header__title' }, [title]);

  // Create close button
  const closeBtn = createElement('button', {
    type: 'button',
    class: 'relay-header__btn relay-header__close',
  });
  closeBtn.innerHTML = CLOSE_ICON;
  closeBtn.setAttribute('aria-label', 'Close widget');
  closeBtn.style.display = showClose ? 'flex' : 'none';
  if (onClose) {
    closeBtn.addEventListener('click', onClose);
  }

  // Assemble
  header.appendChild(backBtn);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  return {
    element: header,
    setTitle: (newTitle: string) => {
      titleEl.textContent = newTitle;
    },
    setShowBack: (show: boolean) => {
      backBtn.style.display = show ? 'flex' : 'none';
    },
  };
}
