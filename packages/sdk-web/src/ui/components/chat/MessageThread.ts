// ============================================================================
// MESSAGE THREAD COMPONENT
// Displays messages in a conversation thread
// ============================================================================

import { createElement, formatRelativeTime } from '../../utils/dom';

export interface Message {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
}

export interface MessageThreadConfig {
  messages: Message[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export const messageThreadStyles = `
  .relay-message-thread {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    gap: 12px;
  }

  .relay-message-thread__load-more {
    display: flex;
    justify-content: center;
    padding: 8px;
  }

  .relay-message-thread__load-more-btn {
    padding: 6px 16px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-primary));
    background: none;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .relay-message-thread__load-more-btn:hover {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  .relay-message-thread__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 32px;
    text-align: center;
    color: hsl(var(--relay-text-muted));
  }

  .relay-message-thread__empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    color: hsl(var(--relay-text-subtle));
  }

  .relay-message-thread__empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
  }

  .relay-message--inbound {
    align-self: flex-start;
  }

  .relay-message--outbound {
    align-self: flex-end;
  }

  .relay-message__bubble {
    padding: 10px 14px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.4;
    word-wrap: break-word;
  }

  .relay-message--inbound .relay-message__bubble {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
    border-bottom-left-radius: 4px;
  }

  .relay-message--outbound .relay-message__bubble {
    background: hsl(var(--relay-primary));
    color: hsl(var(--relay-primary-text));
    border-bottom-right-radius: 4px;
  }

  .relay-message__time {
    font-size: 11px;
    color: hsl(var(--relay-text-subtle));
    margin-top: 4px;
    padding: 0 4px;
  }

  .relay-message--inbound .relay-message__time {
    text-align: left;
  }

  .relay-message--outbound .relay-message__time {
    text-align: right;
  }

  .relay-message-thread__loading {
    display: flex;
    justify-content: center;
    padding: 16px;
  }

  .relay-message-thread__spinner {
    width: 24px;
    height: 24px;
    border: 2px solid hsl(var(--relay-border));
    border-top-color: hsl(var(--relay-primary));
    border-radius: 50%;
    animation: relay-spin 0.8s linear infinite;
  }
`;

export interface MessageThreadResult {
  element: HTMLElement;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  scrollToBottom: () => void;
  setLoading: (loading: boolean) => void;
}

export function createMessageThread(config: MessageThreadConfig): MessageThreadResult {
  const {
    messages: initialMessages,
    onLoadMore,
    hasMore = false,
    loading = false,
  } = config;

  let messages = [...initialMessages];
  let isLoading = loading;

  const container = createElement('div', { class: 'relay-message-thread' });

  // Render messages
  const render = () => {
    container.innerHTML = '';

    // Loading indicator at top
    if (isLoading && messages.length === 0) {
      const loadingEl = createElement('div', { class: 'relay-message-thread__loading' });
      const spinner = createElement('div', { class: 'relay-message-thread__spinner' });
      loadingEl.appendChild(spinner);
      container.appendChild(loadingEl);
      return;
    }

    // Empty state
    if (messages.length === 0) {
      const emptyEl = createElement('div', { class: 'relay-message-thread__empty' });
      const icon = createElement('div', { class: 'relay-message-thread__empty-icon' });
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
      const text = createElement('p', {}, ['No messages yet']);
      emptyEl.appendChild(icon);
      emptyEl.appendChild(text);
      container.appendChild(emptyEl);
      return;
    }

    // Load more button
    if (hasMore && onLoadMore) {
      const loadMoreWrapper = createElement('div', { class: 'relay-message-thread__load-more' });
      const loadMoreBtn = createElement('button', {
        type: 'button',
        class: 'relay-message-thread__load-more-btn',
      }, ['Load earlier messages']);
      loadMoreBtn.addEventListener('click', onLoadMore);
      loadMoreWrapper.appendChild(loadMoreBtn);
      container.appendChild(loadMoreWrapper);
    }

    // Messages
    messages.forEach(msg => {
      const messageEl = createElement('div', {
        class: `relay-message relay-message--${msg.direction}`,
      });

      const bubble = createElement('div', { class: 'relay-message__bubble' }, [msg.body]);
      const time = createElement('div', { class: 'relay-message__time' }, [
        formatRelativeTime(new Date(msg.createdAt)),
      ]);

      messageEl.appendChild(bubble);
      messageEl.appendChild(time);
      container.appendChild(messageEl);
    });
  };

  render();

  // Scroll to bottom after initial render
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 0);

  return {
    element: container,
    setMessages: (newMessages: Message[]) => {
      messages = [...newMessages];
      render();
    },
    addMessage: (message: Message) => {
      messages.push(message);
      render();
      // Auto-scroll to bottom when new message added
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0);
    },
    scrollToBottom: () => {
      container.scrollTop = container.scrollHeight;
    },
    setLoading: (loading: boolean) => {
      isLoading = loading;
      render();
    },
  };
}
