// ============================================================================
// CONVERSATION LIST COMPONENT
// List of past conversations with preview
// ============================================================================

import { createElement, formatRelativeTime, escapeHtml } from '../../utils/dom';

export interface Conversation {
  id: string;
  subject: string;
  lastMessage: {
    body: string;
    direction: 'inbound' | 'outbound';
    createdAt: string;
  };
  unreadCount: number;
  createdAt: string;
}

export interface ConversationListConfig {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
  loading?: boolean;
}

export const conversationListStyles = `
  .relay-conversation-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .relay-conversation-list__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    padding: 32px;
  }

  .relay-conversation-list__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid hsl(var(--relay-border));
    border-top-color: hsl(var(--relay-primary));
    border-radius: 50%;
    animation: relay-spin 0.8s linear infinite;
  }

  .relay-conversation-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 48px 24px;
    text-align: center;
  }

  .relay-conversation-list__empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: hsl(var(--relay-text-subtle));
  }

  .relay-conversation-list__empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .relay-conversation-list__empty-title {
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  .relay-conversation-list__empty-text {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
  }

  .relay-conversation-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: none;
    border: none;
    border-bottom: 1px solid hsl(var(--relay-border));
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    width: 100%;
    font-family: inherit;
  }

  .relay-conversation-item:hover {
    background: hsl(var(--relay-bg-secondary));
  }

  .relay-conversation-item:active {
    background: hsl(var(--relay-bg-tertiary));
  }

  .relay-conversation-item__avatar {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: hsl(var(--relay-primary) / 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: hsl(var(--relay-primary));
  }

  .relay-conversation-item__avatar svg {
    width: 20px;
    height: 20px;
  }

  .relay-conversation-item__content {
    flex: 1;
    min-width: 0;
  }

  .relay-conversation-item__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .relay-conversation-item__subject {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }

  .relay-conversation-item__time {
    font-size: 12px;
    color: hsl(var(--relay-text-subtle));
    flex-shrink: 0;
  }

  .relay-conversation-item__preview {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .relay-conversation-item__message {
    font-size: 13px;
    color: hsl(var(--relay-text-muted));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .relay-conversation-item--unread .relay-conversation-item__subject,
  .relay-conversation-item--unread .relay-conversation-item__message {
    font-weight: 600;
    color: hsl(var(--relay-text));
  }

  .relay-conversation-item__badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: hsl(var(--relay-primary));
    color: hsl(var(--relay-primary-text));
    font-size: 11px;
    font-weight: 700;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
const EMPTY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;

export interface ConversationListResult {
  element: HTMLElement;
  setConversations: (conversations: Conversation[]) => void;
  setLoading: (loading: boolean) => void;
}

export function createConversationList(config: ConversationListConfig): ConversationListResult {
  const {
    conversations: initialConversations,
    onSelect,
    loading = false,
  } = config;

  let conversations = [...initialConversations];
  let isLoading = loading;

  const container = createElement('div', { class: 'relay-conversation-list' });

  // Render list
  const render = () => {
    container.innerHTML = '';

    // Loading state
    if (isLoading) {
      const loadingEl = createElement('div', { class: 'relay-conversation-list__loading' });
      const spinner = createElement('div', { class: 'relay-conversation-list__spinner' });
      loadingEl.appendChild(spinner);
      container.appendChild(loadingEl);
      return;
    }

    // Empty state
    if (conversations.length === 0) {
      const emptyEl = createElement('div', { class: 'relay-conversation-list__empty' });

      const icon = createElement('div', { class: 'relay-conversation-list__empty-icon' });
      icon.innerHTML = EMPTY_ICON;

      const title = createElement('h3', { class: 'relay-conversation-list__empty-title' }, ['No messages yet']);
      const text = createElement('p', { class: 'relay-conversation-list__empty-text' }, ['Start a conversation with us!']);

      emptyEl.appendChild(icon);
      emptyEl.appendChild(title);
      emptyEl.appendChild(text);
      container.appendChild(emptyEl);
      return;
    }

    // Conversation items
    conversations.forEach(conv => {
      const hasUnread = conv.unreadCount > 0;

      const item = createElement('button', {
        type: 'button',
        class: `relay-conversation-item ${hasUnread ? 'relay-conversation-item--unread' : ''}`,
      }) as HTMLButtonElement;

      // Avatar
      const avatar = createElement('div', { class: 'relay-conversation-item__avatar' });
      avatar.innerHTML = CHAT_ICON;

      // Content
      const content = createElement('div', { class: 'relay-conversation-item__content' });

      // Header (subject + time)
      const header = createElement('div', { class: 'relay-conversation-item__header' });
      const subject = createElement('h4', { class: 'relay-conversation-item__subject' }, [
        escapeHtml(conv.subject || 'New conversation'),
      ]);
      const time = createElement('span', { class: 'relay-conversation-item__time' }, [
        formatRelativeTime(new Date(conv.lastMessage.createdAt)),
      ]);
      header.appendChild(subject);
      header.appendChild(time);

      // Preview (message + badge)
      const preview = createElement('div', { class: 'relay-conversation-item__preview' });
      const message = createElement('p', { class: 'relay-conversation-item__message' }, [
        escapeHtml(conv.lastMessage.body),
      ]);
      preview.appendChild(message);

      if (hasUnread) {
        const badge = createElement('span', { class: 'relay-conversation-item__badge' }, [
          conv.unreadCount > 99 ? '99+' : String(conv.unreadCount),
        ]);
        preview.appendChild(badge);
      }

      content.appendChild(header);
      content.appendChild(preview);

      item.appendChild(avatar);
      item.appendChild(content);

      item.addEventListener('click', () => onSelect(conv));

      container.appendChild(item);
    });
  };

  render();

  return {
    element: container,
    setConversations: (newConversations: Conversation[]) => {
      conversations = [...newConversations];
      render();
    },
    setLoading: (loading: boolean) => {
      isLoading = loading;
      render();
    },
  };
}
