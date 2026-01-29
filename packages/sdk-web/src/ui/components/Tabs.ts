// ============================================================================
// TABS COMPONENT
// Tab navigation for Bug/Feedback/Chat
// ============================================================================

import { createElement } from '../utils/dom';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  hidden?: boolean;
}

export interface TabsConfig {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
}

export const tabsStyles = `
  .relay-tabs {
    display: flex;
    gap: 4px;
    padding: 4px 20px 12px;
    background: hsl(var(--relay-bg));
    border-bottom: 1px solid hsl(var(--relay-border));
    flex-shrink: 0;
  }

  .relay-tabs__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--relay-text-muted));
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .relay-tabs__tab:hover:not(:disabled):not(.relay-tabs__tab--active) {
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
  }

  .relay-tabs__tab:focus-visible {
    outline: 2px solid hsl(var(--relay-primary));
    outline-offset: 2px;
  }

  .relay-tabs__tab--active {
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border));
    font-weight: 600;
  }

  .relay-tabs__tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .relay-tabs__tab-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  .relay-tabs__tab-icon svg {
    width: 100%;
    height: 100%;
    stroke-width: 2;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .relay-tabs {
      padding: 6px 16px 12px;
    }

    .relay-tabs__tab {
      padding: 8px 10px;
      font-size: 12px;
    }

    .relay-tabs__tab-icon {
      width: 14px;
      height: 14px;
    }
  }
`;

// Default icons for common tabs
const TAB_ICONS: Record<string, string> = {
  bug: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>`,
  feedback: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>`,
};

export interface TabsResult {
  element: HTMLElement;
  setActiveTab: (tabId: string) => void;
  getActiveTab: () => string;
  setTabs: (tabs: Tab[]) => void;
  setTabDisabled: (tabId: string, disabled: boolean) => void;
  setTabHidden: (tabId: string, hidden: boolean) => void;
}

export function createTabs(config: TabsConfig): TabsResult {
  const { tabs, activeTab, onChange } = config;
  let currentTabs = [...tabs];
  let currentActiveTab = activeTab || tabs.find(t => !t.hidden && !t.disabled)?.id || '';

  // Create container
  const container = createElement('div', { class: 'relay-tabs', role: 'tablist' });

  // Create tab buttons
  const tabButtons = new Map<string, HTMLButtonElement>();

  const renderTabs = () => {
    container.innerHTML = '';
    tabButtons.clear();

    currentTabs.forEach((tab) => {
      if (tab.hidden) return;

      const button = createElement('button', {
        type: 'button',
        class: `relay-tabs__tab ${tab.id === currentActiveTab ? 'relay-tabs__tab--active' : ''}`,
        disabled: tab.disabled,
      }) as HTMLButtonElement;

      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(tab.id === currentActiveTab));
      button.setAttribute('aria-controls', `relay-tabpanel-${tab.id}`);
      button.id = `relay-tab-${tab.id}`;

      // Add icon if provided or use default
      const iconSvg = tab.icon || TAB_ICONS[tab.id];
      if (iconSvg) {
        const iconEl = createElement('span', { class: 'relay-tabs__tab-icon' });
        iconEl.innerHTML = iconSvg;
        button.appendChild(iconEl);
      }

      // Add label
      button.appendChild(document.createTextNode(tab.label));

      // Click handler
      button.addEventListener('click', () => {
        if (tab.disabled || tab.id === currentActiveTab) return;
        setActiveTab(tab.id);
        onChange?.(tab.id);
      });

      // Keyboard navigation
      button.addEventListener('keydown', (e) => {
        const visibleTabs = currentTabs.filter(t => !t.hidden && !t.disabled);
        const currentIndex = visibleTabs.findIndex(t => t.id === tab.id);

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const direction = e.key === 'ArrowLeft' ? -1 : 1;
          const nextIndex = (currentIndex + direction + visibleTabs.length) % visibleTabs.length;
          const nextTab = visibleTabs[nextIndex];
          tabButtons.get(nextTab.id)?.focus();
        }
      });

      tabButtons.set(tab.id, button);
      container.appendChild(button);
    });
  };

  const setActiveTab = (tabId: string) => {
    const prevButton = tabButtons.get(currentActiveTab);
    const nextButton = tabButtons.get(tabId);

    if (prevButton) {
      prevButton.classList.remove('relay-tabs__tab--active');
      prevButton.setAttribute('aria-selected', 'false');
    }

    if (nextButton) {
      nextButton.classList.add('relay-tabs__tab--active');
      nextButton.setAttribute('aria-selected', 'true');
    }

    currentActiveTab = tabId;
  };

  renderTabs();

  return {
    element: container,
    setActiveTab,
    getActiveTab: () => currentActiveTab,
    setTabs: (newTabs: Tab[]) => {
      currentTabs = [...newTabs];
      // Ensure active tab is still valid
      if (!currentTabs.find(t => t.id === currentActiveTab && !t.hidden && !t.disabled)) {
        currentActiveTab = currentTabs.find(t => !t.hidden && !t.disabled)?.id || '';
      }
      renderTabs();
    },
    setTabDisabled: (tabId: string, disabled: boolean) => {
      const tab = currentTabs.find(t => t.id === tabId);
      if (tab) {
        tab.disabled = disabled;
        const button = tabButtons.get(tabId);
        if (button) {
          button.disabled = disabled;
        }
      }
    },
    setTabHidden: (tabId: string, hidden: boolean) => {
      const tab = currentTabs.find(t => t.id === tabId);
      if (tab) {
        tab.hidden = hidden;
        renderTabs();
      }
    },
  };
}
