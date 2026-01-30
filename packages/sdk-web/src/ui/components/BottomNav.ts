// ============================================================================
// BOTTOM NAVIGATION COMPONENT
// Persistent navigation bar at bottom of widget
// ============================================================================

import { createElement } from "../utils/dom";

export type NavTab = "home" | "messages" | "help" | "roadmap";

export interface BottomNavConfig {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  showMessages?: boolean;
  showHelp?: boolean;
  showRoadmap?: boolean;
  unreadCount?: number;
}

export const bottomNavStyles = `
  #relay-widget .relay-bottom-nav {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 8px 16px 12px;
    background: hsl(var(--relay-bg));
    border-top: 1px solid hsl(var(--relay-border));
    flex-shrink: 0;
  }

  #relay-widget .relay-bottom-nav__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    background: none;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    transition: all 0.15s ease;
    position: relative;
    font-family: inherit;
  }

  #relay-widget .relay-bottom-nav__item:hover {
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-bottom-nav__item--active {
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-bottom-nav__item--active .relay-bottom-nav__icon {
    background: hsl(var(--relay-text));
    color: hsl(var(--relay-bg));
  }

  #relay-widget .relay-bottom-nav__icon {
    width: 28px;
    height: 28px;
    padding: 4px;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-bottom-nav__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-bottom-nav__label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  #relay-widget .relay-bottom-nav__badge {
    position: absolute;
    top: 4px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: hsl(var(--relay-error));
    color: white;
    font-size: 10px;
    font-weight: 700;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const ICONS: Record<string, string> = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>`,
  homeActive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  messagesActive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  helpActive: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="17" r="1" fill="white"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="white" stroke-width="2" fill="none"/></svg>`,
  roadmap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 5H10V3.5c0-.83-.67-1.5-1.5-1.5S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>`,
  roadmapActive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 5H10V3.5c0-.83-.67-1.5-1.5-1.5S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>`,
};

export interface BottomNavResult {
  element: HTMLElement;
  setActiveTab: (tab: NavTab) => void;
  setUnreadCount: (count: number) => void;
}

export function createBottomNav(config: BottomNavConfig): BottomNavResult {
  const {
    activeTab,
    onTabChange,
    showMessages = true,
    showHelp = true,
    showRoadmap = true,
    unreadCount = 0,
  } = config;

  let currentTab = activeTab;
  let currentUnread = unreadCount;

  const nav = createElement("nav", { class: "relay-bottom-nav" });

  const tabs: { id: NavTab; label: string; show: boolean }[] = [
    { id: "home", label: "Home", show: true },
    { id: "messages", label: "Messages", show: showMessages },
    { id: "help", label: "Help", show: showHelp },
    { id: "roadmap", label: "Roadmap", show: showRoadmap },
  ];

  const buttons = new Map<NavTab, HTMLButtonElement>();
  const badges = new Map<NavTab, HTMLElement>();

  tabs.forEach(({ id, label, show }) => {
    if (!show) return;

    const btn = createElement("button", {
      type: "button",
      class: `relay-bottom-nav__item ${id === currentTab ? "relay-bottom-nav__item--active" : ""}`,
    }) as HTMLButtonElement;

    const icon = createElement("span", { class: "relay-bottom-nav__icon" });
    icon.innerHTML =
      id === currentTab ? ICONS[`${id}Active`] || ICONS[id] : ICONS[id];

    const labelEl = createElement(
      "span",
      { class: "relay-bottom-nav__label" },
      [label],
    );

    // Badge for messages
    if (id === "messages") {
      const badge = createElement("span", { class: "relay-bottom-nav__badge" });
      badge.style.display = currentUnread > 0 ? "flex" : "none";
      badge.textContent = currentUnread > 99 ? "99+" : String(currentUnread);
      btn.appendChild(badge);
      badges.set(id, badge);
    }

    btn.appendChild(icon);
    btn.appendChild(labelEl);

    btn.addEventListener("click", () => {
      if (id === currentTab) return;
      setActiveTab(id);
      onTabChange(id);
    });

    buttons.set(id, btn);
    nav.appendChild(btn);
  });

  const setActiveTab = (tab: NavTab) => {
    const prevBtn = buttons.get(currentTab);
    const nextBtn = buttons.get(tab);

    if (prevBtn) {
      prevBtn.classList.remove("relay-bottom-nav__item--active");
      const icon = prevBtn.querySelector(".relay-bottom-nav__icon");
      if (icon) icon.innerHTML = ICONS[currentTab];
    }

    if (nextBtn) {
      nextBtn.classList.add("relay-bottom-nav__item--active");
      const icon = nextBtn.querySelector(".relay-bottom-nav__icon");
      if (icon) icon.innerHTML = ICONS[`${tab}Active`] || ICONS[tab];
    }

    currentTab = tab;
  };

  return {
    element: nav,
    setActiveTab,
    setUnreadCount: (count: number) => {
      currentUnread = count;
      const badge = badges.get("messages");
      if (badge) {
        badge.style.display = count > 0 ? "flex" : "none";
        badge.textContent = count > 99 ? "99+" : String(count);
      }
    },
  };
}
