// ============================================================================
// CHAT FORM COMPONENT
// Initial chat message form
// ============================================================================

import { createElement, clearChildren } from '../../utils/dom';
import { createTextarea, type TextareaResult } from '../shared/Textarea';
import { createButton, setButtonLoading } from '../shared/Button';

export interface ChatFormData {
  message: string;
}

export interface ChatFormConfig {
  placeholder?: string;
  onSubmit: (data: ChatFormData) => Promise<void>;
}

export const chatFormStyles = `
  .relay-chat-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }

  .relay-chat-form__footer {
    padding-top: 4px;
  }

  .relay-chat-form__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-chat-form__success-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
    color: hsl(var(--relay-success));
    background: hsl(var(--relay-success) / 0.1);
    border-radius: 50%;
    padding: 12px;
  }

  .relay-chat-form__success-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-chat-form__success h4 {
    font-size: 18px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }

  .relay-chat-form__success p {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }
`;

export interface ChatFormResult {
  element: HTMLFormElement;
  reset: () => void;
  showSuccess: () => void;
}

export function createChatForm(config: ChatFormConfig): ChatFormResult {
  const { placeholder = 'How can we help you?', onSubmit } = config;

  // Create form element
  const form = createElement('form', { class: 'relay-chat-form' }) as HTMLFormElement;

  // Message textarea
  const messageTextarea = createTextarea('Message', {
    name: 'message',
    placeholder,
    required: true,
    rows: 4,
    maxLength: 2000,
    autoFocus: true,
  });

  // Submit button
  const submitBtn = createButton('Start Conversation', {
    type: 'submit',
    variant: 'primary',
    fullWidth: true,
  });

  const footer = createElement('div', { class: 'relay-chat-form__footer' });
  footer.appendChild(submitBtn);

  // Assemble form
  form.appendChild(messageTextarea.container);
  form.appendChild(footer);

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate
    if (!messageTextarea.getValue().trim()) {
      messageTextarea.setError('Please enter a message');
      return;
    }

    // Clear errors
    messageTextarea.setError(null);

    // Collect form data
    const formData: ChatFormData = {
      message: messageTextarea.getValue().trim(),
    };

    // Show loading state
    setButtonLoading(submitBtn, true, 'Sending...');

    try {
      await onSubmit(formData);
    } catch (error) {
      setButtonLoading(submitBtn, false);
      console.error('[Relay] Chat message failed:', error);
    }
  });

  // Reset form
  const reset = () => {
    form.reset();
    messageTextarea.setValue('');
    messageTextarea.setError(null);
    setButtonLoading(submitBtn, false);
  };

  // Show success state
  const showSuccess = () => {
    clearChildren(form);
    form.className = '';

    const successEl = createElement('div', { class: 'relay-chat-form__success' });

    const icon = createElement('div', { class: 'relay-chat-form__success-icon' });
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    const title = createElement('h4', {}, ['Message sent!']);
    const message = createElement('p', {}, ["We'll get back to you soon."]);

    successEl.appendChild(icon);
    successEl.appendChild(title);
    successEl.appendChild(message);
    form.appendChild(successEl);
  };

  return {
    element: form,
    reset,
    showSuccess,
  };
}
