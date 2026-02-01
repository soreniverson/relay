// ============================================================================
// HOME PAGE COMPONENT
// Welcome screen with chat input and quick actions
// ============================================================================

import { createElement } from "../../utils/dom";

export interface HomePageConfig {
  greeting?: string;
  subtitle?: string;
  onChatSubmit: (message: string) => void;
  onReportBug: () => void;
  onRequestFeature: () => void;
}

export const homePageStyles = `
  #relay-widget .relay-home {
    display: flex;
    flex-direction: column;
    padding: 32px 24px 24px;
    flex: 1;
  }

  #relay-widget .relay-home__greeting {
    margin-bottom: 24px;
    text-align: center;
  }

  #relay-widget .relay-home__greeting h2 {
    font-size: 22px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 6px;
    letter-spacing: -0.02em;
  }

  #relay-widget .relay-home__greeting p {
    font-size: 14px;
    color: hsl(var(--relay-text-secondary));
    margin: 0;
  }

  #relay-widget .relay-home__chat-input {
    position: relative;
    margin-bottom: 16px;
  }

  #relay-widget .relay-home__chat-input input {
    width: 100%;
    padding: 14px 52px 14px 16px;
    font-family: inherit;
    font-size: 15px;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg-secondary));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 24px;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-home__chat-input input::placeholder {
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-home__chat-input input:hover {
    border-color: hsl(var(--relay-border-hover));
  }

  #relay-widget .relay-home__chat-input input:focus {
    outline: none;
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg));
    box-shadow: 0 0 0 3px hsl(var(--relay-primary) / 0.08);
  }

  #relay-widget .relay-home__chat-submit {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
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

  #relay-widget .relay-home__chat-submit:hover:not(:disabled) {
    background: hsl(var(--relay-primary-hover));
  }

  #relay-widget .relay-home__chat-submit:active:not(:disabled) {
    transform: translateY(-50%) scale(0.95);
  }

  #relay-widget .relay-home__chat-submit--active {
    opacity: 1;
  }

  #relay-widget .relay-home__chat-submit svg {
    width: 18px;
    height: 18px;
  }

  #relay-widget .relay-home__actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  #relay-widget .relay-home__action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    background: hsl(var(--relay-bg));
    border: 1px solid hsl(var(--relay-border));
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-home__action-btn:hover {
    background: hsl(var(--relay-bg-secondary));
    border-color: hsl(var(--relay-border-hover));
  }

  #relay-widget .relay-home__action-btn:active {
    transform: scale(0.98);
  }

  #relay-widget .relay-home__action-btn svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
const BUG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.5 1.5M16 2l-1.5 1.5M9 18h6M12 18v4"/><circle cx="12" cy="11" r="5"/><path d="M5 11h2M17 11h2M7.5 6.5l-2-2M16.5 6.5l2-2"/></svg>`;
const LIGHTBULB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`;

export interface HomePageResult {
  element: HTMLElement;
  focus: () => void;
}

export function createHomePage(config: HomePageConfig): HomePageResult {
  const {
    greeting = "Hi there!",
    subtitle = "How can we help you today?",
    onChatSubmit,
    onReportBug,
    onRequestFeature,
  } = config;

  const container = createElement("div", { class: "relay-home" });

  // Greeting section
  const greetingSection = createElement("div", {
    class: "relay-home__greeting",
  });
  const greetingTitle = createElement("h2", {}, [greeting]);
  const greetingSubtitle = createElement("p", {}, [subtitle]);
  greetingSection.appendChild(greetingTitle);
  greetingSection.appendChild(greetingSubtitle);

  // Chat input
  const chatInputWrapper = createElement("div", {
    class: "relay-home__chat-input",
  });
  const chatInput = createElement("input", {
    type: "text",
    placeholder: "Ask us anything...",
  }) as HTMLInputElement;

  const chatSubmitBtn = createElement("button", {
    type: "button",
    class: "relay-home__chat-submit",
  }) as HTMLButtonElement;
  chatSubmitBtn.innerHTML = SEND_ICON;
  chatSubmitBtn.setAttribute("aria-label", "Send message");

  chatInputWrapper.appendChild(chatInput);
  chatInputWrapper.appendChild(chatSubmitBtn);

  // Update button state based on input
  chatInput.addEventListener("input", () => {
    const hasValue = chatInput.value.trim().length > 0;
    chatSubmitBtn.classList.toggle("relay-home__chat-submit--active", hasValue);
  });

  // Handle submit
  const handleSubmit = () => {
    const message = chatInput.value.trim();
    if (message) {
      onChatSubmit(message);
      chatInput.value = "";
      chatSubmitBtn.classList.remove("relay-home__chat-submit--active");
    }
  };

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  chatSubmitBtn.addEventListener("click", handleSubmit);

  // Quick action buttons
  const actionsSection = createElement("div", { class: "relay-home__actions" });

  const bugBtn = createElement("button", {
    type: "button",
    class: "relay-home__action-btn",
  });
  bugBtn.innerHTML = `${BUG_ICON} Report a bug`;
  bugBtn.addEventListener("click", onReportBug);

  const featureBtn = createElement("button", {
    type: "button",
    class: "relay-home__action-btn",
  });
  featureBtn.innerHTML = `${LIGHTBULB_ICON} Request a feature`;
  featureBtn.addEventListener("click", onRequestFeature);

  actionsSection.appendChild(bugBtn);
  actionsSection.appendChild(featureBtn);

  // Assemble
  container.appendChild(greetingSection);
  container.appendChild(chatInputWrapper);
  container.appendChild(actionsSection);

  return {
    element: container,
    focus: () => chatInput.focus(),
  };
}
