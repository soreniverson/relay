// ============================================================================
// CHAT INPUT COMPONENT
// Message input with send button for chat threads
// ============================================================================

import { createElement } from "../../utils/dom";

export interface ChatInputConfig {
  placeholder?: string;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const chatInputStyles = `
  .relay-chat-input {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 16px;
    background: hsl(var(--relay-bg));
    border-top: 1px solid hsl(var(--relay-border));
  }

  .relay-chat-input__field {
    flex: 1;
    display: flex;
    align-items: flex-end;
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 20px;
    padding: 10px 16px;
    transition: all 0.15s ease;
  }

  .relay-chat-input__field:hover {
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-chat-input__field:focus-within {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  .relay-chat-input__textarea {
    flex: 1;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 14px;
    color: hsl(var(--relay-text));
    resize: none;
    outline: none;
    max-height: 100px;
    min-height: 20px;
    line-height: 1.4;
  }

  .relay-chat-input__textarea::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  .relay-chat-input__send {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 0;
    background: hsl(var(--relay-primary));
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: hsl(var(--relay-primary-text));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    opacity: 0.4;
  }

  .relay-chat-input__send:hover:not(:disabled) {
    background: hsl(var(--relay-primary-hover));
  }

  .relay-chat-input__send:active:not(:disabled) {
    transform: scale(0.95);
  }

  .relay-chat-input__send--active {
    opacity: 1;
  }

  .relay-chat-input__send:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .relay-chat-input__send svg {
    width: 18px;
    height: 18px;
  }
`;

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;

export interface ChatInputResult {
  element: HTMLElement;
  focus: () => void;
  clear: () => void;
  setDisabled: (disabled: boolean) => void;
}

export function createChatInput(config: ChatInputConfig): ChatInputResult {
  const {
    placeholder = "Type a message...",
    onSend,
    disabled = false,
  } = config;

  let isDisabled = disabled;

  const container = createElement("div", { class: "relay-chat-input" });

  const fieldWrapper = createElement("div", {
    class: "relay-chat-input__field",
  });

  const textarea = createElement("textarea", {
    class: "relay-chat-input__textarea",
    placeholder,
    rows: 1,
  }) as HTMLTextAreaElement;

  const sendBtn = createElement("button", {
    type: "button",
    class: "relay-chat-input__send",
    disabled: isDisabled,
  }) as HTMLButtonElement;
  sendBtn.innerHTML = SEND_ICON;
  sendBtn.setAttribute("aria-label", "Send message");

  fieldWrapper.appendChild(textarea);
  container.appendChild(fieldWrapper);
  container.appendChild(sendBtn);

  // Auto-resize textarea
  const autoResize = () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
  };

  // Update button state
  const updateButtonState = () => {
    const hasValue = textarea.value.trim().length > 0;
    sendBtn.classList.toggle(
      "relay-chat-input__send--active",
      hasValue && !isDisabled,
    );
  };

  textarea.addEventListener("input", () => {
    autoResize();
    updateButtonState();
  });

  // Handle send
  const handleSend = () => {
    const message = textarea.value.trim();
    if (message && !isDisabled) {
      onSend(message);
      textarea.value = "";
      autoResize();
      updateButtonState();
    }
  };

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener("click", handleSend);

  return {
    element: container,
    focus: () => textarea.focus(),
    clear: () => {
      textarea.value = "";
      autoResize();
      updateButtonState();
    },
    setDisabled: (disabled: boolean) => {
      isDisabled = disabled;
      sendBtn.disabled = disabled;
      textarea.disabled = disabled;
      updateButtonState();
    },
  };
}
