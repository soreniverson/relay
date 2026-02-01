// ============================================================================
// WIDGET ORCHESTRATOR
// Main widget class that coordinates all UI components
// ============================================================================

import { createElement, createStyleSheet } from "./utils/dom";
import { generateBaseCSS, generateResponsiveCSS } from "./styles/base";
import { onThemeChange, type ThemeMode } from "./styles/theme";
import { sharedComponentStyles } from "./components/shared";
import { formComponentStyles } from "./components/forms";
import { screenshotComponentStyles } from "./components/screenshot";
import { chatComponentStyles } from "./components/chat";
import { roadmapComponentStyles } from "./components/roadmap";
import { pageStyles } from "./components/pages";

import {
  createTrigger,
  triggerStyles,
  type TriggerResult,
} from "./components/Trigger";
import { createModal, modalStyles, type ModalResult } from "./components/Modal";
import {
  createBottomNav,
  bottomNavStyles,
  type BottomNavResult,
  type NavTab,
} from "./components/BottomNav";
import {
  createHomePage,
  type HomePageResult,
} from "./components/pages/HomePage";

import {
  createBugReportForm,
  type BugReportFormResult,
  type BugReportFormData,
} from "./components/forms/BugReportForm";
import {
  createFeedbackForm,
  type FeedbackFormResult,
  type FeedbackFormData,
} from "./components/forms/FeedbackForm";
import {
  createFeatureRequestForm,
  type FeatureRequestFormResult,
  type FeatureRequestFormData,
} from "./components/forms/FeatureRequestForm";
import {
  createScreenshotEditor,
  type ScreenshotEditorResult,
} from "./components/screenshot/ScreenshotEditor";

import {
  createConversationList,
  type ConversationListResult,
  type Conversation,
} from "./components/chat/ConversationList";
import {
  createMessageThread,
  type MessageThreadResult,
  type Message,
} from "./components/chat/MessageThread";
import {
  createChatInput,
  type ChatInputResult,
} from "./components/chat/ChatInput";

import {
  createRoadmapList,
  type RoadmapListResult,
  type RoadmapItemData,
} from "./components/roadmap/RoadmapList";

import {
  getMockConversations,
  getMockMessages,
  getMockRoadmap,
  toggleMockVote,
  addMockMessage,
  createMockConversation,
} from "./mockData";

import type { Annotation, WidgetConfig } from "../types";

export type WidgetView =
  | "home"
  | "messages"
  | "messages-thread"
  | "help"
  | "help-article"
  | "roadmap"
  | "bug-report"
  | "feature-request";

// API response types
export interface ApiConversation {
  id: string;
  subject: string | null;
  lastMessage: {
    body: string;
    direction: "inbound" | "outbound";
    createdAt: string;
  } | null;
  unreadCount: number;
  createdAt: string;
}

export interface ApiMessage {
  id: string;
  body: string;
  direction: "inbound" | "outbound";
  createdAt: string;
}

export interface ApiRoadmapItem {
  id: string;
  title: string;
  description: string | null;
  status: "planned" | "in_progress" | "shipped";
  voteCount: number;
  hasVoted: boolean;
}

export interface ApiHelpCategory {
  id: string;
  name: string;
  description?: string;
  articleCount: number;
}

export interface ApiHelpArticle {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  contentHtml?: string;
  categoryId?: string;
  categoryName?: string;
}

export interface WidgetCallbacks {
  // Form submissions
  onBugSubmit: (
    data: BugReportFormData & {
      screenshotBlob?: Blob;
      annotations?: Annotation[];
    },
  ) => Promise<void>;
  onFeedbackSubmit: (data: FeedbackFormData) => Promise<void>;
  onFeatureRequestSubmit: (data: FeatureRequestFormData) => Promise<void>;
  onScreenshotCapture: () => Promise<Blob | null>;

  // Chat API
  onFetchConversations: () => Promise<ApiConversation[]>;
  onFetchMessages: (
    conversationId: string,
  ) => Promise<{ messages: ApiMessage[]; hasMore: boolean }>;
  onSendMessage: (
    conversationId: string,
    body: string,
  ) => Promise<{ messageId: string }>;
  onStartConversation: (
    message: string,
  ) => Promise<{ conversationId: string; messageId: string }>;
  onMarkMessagesRead: (conversationId: string) => Promise<void>;

  // Roadmap API
  onFetchRoadmap: () => Promise<ApiRoadmapItem[]>;
  onVote: (itemId: string) => Promise<void>;
  onUnvote: (itemId: string) => Promise<void>;

  // Help API
  onFetchHelpCategories: () => Promise<ApiHelpCategory[]>;
  onFetchHelpArticles: (categoryId?: string) => Promise<ApiHelpArticle[]>;
  onSearchHelpArticles: (query: string) => Promise<ApiHelpArticle[]>;
  onFetchHelpArticle: (slug: string) => Promise<ApiHelpArticle | null>;

  // File upload
  onUploadFiles: (files: File[]) => Promise<string[]>; // returns array of mediaIds
}

export interface WidgetOptions {
  config: WidgetConfig;
  callbacks: WidgetCallbacks;
  themeMode?: ThemeMode;
  useMockData?: boolean; // For testing without API
}

// Minimal header styles for sub-pages
const pageHeaderStyles = `
  #relay-widget .relay-page-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid hsl(var(--relay-border));
    background: hsl(var(--relay-bg));
    flex-shrink: 0;
  }

  #relay-widget .relay-page-header__back {
    width: 32px;
    height: 32px;
    padding: 0;
    margin-right: 8px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  #relay-widget .relay-page-header__back:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-page-header__back svg {
    width: 20px;
    height: 20px;
  }

  #relay-widget .relay-page-header__title {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0;
    letter-spacing: -0.01em;
  }

  #relay-widget .relay-page-header__close {
    width: 32px;
    height: 32px;
    padding: 0;
    margin-left: 8px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: hsl(var(--relay-text-muted));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  #relay-widget .relay-page-header__close:hover {
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-page-header__close svg {
    width: 18px;
    height: 18px;
  }

  #relay-widget .relay-page-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  #relay-widget .relay-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    flex: 1;
    min-height: 300px;
  }

  #relay-widget .relay-empty-state__icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    color: hsl(var(--relay-text-subtle));
  }

  #relay-widget .relay-empty-state__icon svg {
    width: 100%;
    height: 100%;
  }

  #relay-widget .relay-empty-state__title {
    font-size: 17px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  #relay-widget .relay-empty-state__text {
    font-size: 14px;
    color: hsl(var(--relay-text-muted));
    margin: 0 0 20px;
  }

  #relay-widget .relay-toast {
    position: absolute;
    bottom: 70px;
    left: 16px;
    right: 16px;
    padding: 12px 16px;
    background: hsl(var(--relay-error));
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    animation: relay-slide-up 0.2s ease-out;
  }

  #relay-widget .relay-toast--success {
    background: hsl(var(--relay-success));
  }

  #relay-widget .relay-toast--exit {
    animation: relay-slide-down 0.15s ease-in forwards;
  }

  /* Help styles */
  #relay-widget .relay-help-search {
    padding: 12px 16px;
    border-bottom: 1px solid hsl(var(--relay-border));
  }

  #relay-widget .relay-help-search__input {
    width: 100%;
    padding: 10px 12px 10px 36px;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    background: hsl(var(--relay-bg-secondary));
    color: hsl(var(--relay-text));
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  #relay-widget .relay-help-search__input:focus {
    border-color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-help-search__input::placeholder {
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-help-search__wrapper {
    position: relative;
  }

  #relay-widget .relay-help-search__icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-help-categories {
    padding: 12px 16px;
  }

  #relay-widget .relay-help-category {
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  #relay-widget .relay-help-category:hover {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-help-category__name {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  #relay-widget .relay-help-category__count {
    font-size: 12px;
    color: hsl(var(--relay-text-muted));
  }

  #relay-widget .relay-help-articles {
    padding: 0 16px 16px;
  }

  #relay-widget .relay-help-article-item {
    display: block;
    width: 100%;
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid hsl(var(--relay-border));
    border-radius: 8px;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  #relay-widget .relay-help-article-item:hover {
    border-color: hsl(var(--relay-primary));
    background: hsl(var(--relay-bg-secondary));
  }

  #relay-widget .relay-help-article-item__title {
    font-size: 14px;
    font-weight: 500;
    color: hsl(var(--relay-text));
    margin: 0 0 4px;
  }

  #relay-widget .relay-help-article-item__excerpt {
    font-size: 13px;
    color: hsl(var(--relay-text-muted));
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  #relay-widget .relay-help-article-content {
    padding: 16px;
  }

  #relay-widget .relay-help-article-content h1 {
    font-size: 20px;
    font-weight: 600;
    color: hsl(var(--relay-text));
    margin: 0 0 16px;
  }

  #relay-widget .relay-help-article-content .relay-article-body {
    font-size: 14px;
    line-height: 1.6;
    color: hsl(var(--relay-text));
  }

  #relay-widget .relay-help-article-content .relay-article-body p {
    margin: 0 0 12px;
  }

  #relay-widget .relay-help-article-content .relay-article-body a {
    color: hsl(var(--relay-primary));
  }

  #relay-widget .relay-help-section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--relay-text-muted));
    margin: 0 0 8px;
    padding: 0 16px;
  }

  #relay-widget .relay-help-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: hsl(var(--relay-text-muted));
  }
`;

const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export class Widget {
  private container: HTMLDivElement | null = null;
  private trigger: TriggerResult | null = null;
  private modal: ModalResult | null = null;
  private bottomNav: BottomNavResult | null = null;
  private homePage: HomePageResult | null = null;

  private bugReportForm: BugReportFormResult | null = null;
  private feedbackForm: FeedbackFormResult | null = null;
  private featureRequestForm: FeatureRequestFormResult | null = null;
  private screenshotEditor: ScreenshotEditorResult | null = null;

  // Chat components
  private conversationList: ConversationListResult | null = null;
  private messageThread: MessageThreadResult | null = null;
  private chatInput: ChatInputResult | null = null;
  private currentConversation: Conversation | null = null;
  private messagePollingInterval: ReturnType<typeof setInterval> | null = null;

  // Roadmap components
  private roadmapList: RoadmapListResult | null = null;
  private roadmapItems: RoadmapItemData[] = [];

  // Help state
  private helpCategories: ApiHelpCategory[] = [];
  private helpArticles: ApiHelpArticle[] = [];
  private currentHelpArticle: ApiHelpArticle | null = null;
  private helpSearchQuery: string = "";

  // State
  private currentView: WidgetView = "home";
  private isOpen = false;
  private screenshotBlob: Blob | null = null;
  private annotations: Annotation[] = [];

  // Form dirty state tracking
  private formDirty = false;

  // Error state
  private lastError: string | null = null;

  // Prefill data
  private prefillData: {
    title?: string;
    description?: string;
    email?: string;
    category?: string;
    tags?: string[];
  } = {};

  private config: WidgetConfig;
  private callbacks: WidgetCallbacks;
  private themeMode: ThemeMode;
  private useMockData: boolean;
  private removeThemeListener: (() => void) | null = null;

  constructor(options: WidgetOptions) {
    this.config = options.config;
    this.callbacks = options.callbacks;
    this.themeMode = options.themeMode || "auto";
    this.useMockData = options.useMockData ?? false;
  }

  /**
   * Mounts the widget to the DOM
   */
  mount(): void {
    if (this.container) return;

    // Create container
    this.container = createElement("div", {
      id: "relay-widget",
    }) as HTMLDivElement;

    // Inject styles
    const styles = this.generateStyles();
    const styleSheet = createStyleSheet(styles, "relay-widget-styles");
    this.container.appendChild(styleSheet);

    // Create trigger button
    this.trigger = createTrigger({
      position: this.config.position || "bottom-right",
      onClick: () => this.toggle(),
    });
    this.container.appendChild(this.trigger.element);

    // Create modal
    this.modal = createModal({
      position: this.config.position || "bottom-right",
      onClose: () => this.handleClose(),
    });
    this.container.appendChild(this.modal.overlay);
    this.container.appendChild(this.modal.element);

    // Create bottom nav
    this.bottomNav = createBottomNav({
      activeTab: "home",
      showMessages: this.config.showChat !== false,
      showHelp: false, // Knowledge Base cut from MVP
      showRoadmap: this.config.showRoadmap !== false,
      onTabChange: (tab) => this.handleNavChange(tab),
    });

    // Create home page
    this.homePage = createHomePage({
      greeting: "Hi there!",
      subtitle: "How can we help you today?",
      onChatSubmit: (message) => this.handleChatSubmit(message),
      onReportBug: () => this.navigateTo("bug-report"),
      onRequestFeature: () => this.navigateTo("feature-request"),
    });

    // Set up initial content
    this.renderCurrentView();

    // Listen for theme changes
    if (this.themeMode === "auto") {
      this.removeThemeListener = onThemeChange(() => {
        this.updateTheme();
      });
    }

    // Append to body
    document.body.appendChild(this.container);
  }

  /**
   * Unmounts the widget from the DOM
   */
  unmount(): void {
    // Stop message polling
    this.stopMessagePolling();

    if (this.removeThemeListener) {
      this.removeThemeListener();
      this.removeThemeListener = null;
    }

    this.trigger?.destroy();
    this.modal?.destroy();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.trigger = null;
    this.modal = null;
    this.bottomNav = null;
    this.homePage = null;
    this.bugReportForm = null;
    this.feedbackForm = null;
    this.featureRequestForm = null;
    this.conversationList = null;
    this.messageThread = null;
    this.chatInput = null;
    this.currentConversation = null;
    this.roadmapList = null;
  }

  /**
   * Opens the widget
   */
  open(view?: WidgetView): void {
    if (this.isOpen) {
      if (view && view !== this.currentView) {
        this.navigateTo(view);
      }
      return;
    }

    this.isOpen = true;
    this.trigger?.setOpen(true);
    this.modal?.open();

    if (view) {
      this.navigateTo(view);
    } else {
      this.homePage?.focus();
    }
  }

  /**
   * Closes the widget
   */
  close(): void {
    if (!this.isOpen) return;

    // Check for unsaved changes
    if (!this.confirmDiscard()) return;

    // Stop message polling
    this.stopMessagePolling();

    this.isOpen = false;
    this.formDirty = false;
    this.trigger?.setOpen(false);
    this.modal?.close();

    // Reset to home after close animation
    setTimeout(() => {
      if (!this.isOpen) {
        this.navigateTo("home");
      }
    }, 200);
  }

  /**
   * Toggles the widget open/closed state
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Returns whether the widget is currently open
   */
  isWidgetOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Sets the notification badge count
   */
  setBadge(count: number | null): void {
    this.trigger?.setBadge(count);
    this.bottomNav?.setUnreadCount(count || 0);
  }

  /**
   * Updates widget configuration
   */
  updateConfig(config: Partial<WidgetConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.position) {
      this.trigger?.updatePosition(config.position);
      this.modal?.updatePosition(config.position);
    }

    if (config.primaryColor) {
      this.updateTheme();
    }
  }

  /**
   * Set prefill data for forms
   */
  setPrefillData(data: {
    title?: string;
    description?: string;
    email?: string;
    category?: string;
    tags?: string[];
  }): void {
    this.prefillData = data;
    // Apply to existing forms if they're mounted
    if (this.bugReportForm) {
      this.bugReportForm.setPrefillData({
        title: data.title,
        description: data.description,
      });
    }
    if (this.featureRequestForm) {
      this.featureRequestForm.setPrefillData({
        title: data.title,
        description: data.description,
        category: data.category,
      });
    }
  }

  /**
   * Show a specific survey by ID
   */
  showSurvey(surveyId: string): void {
    // Survey rendering will be handled by a separate Survey component
    // For now, emit an event that can be handled by the SDK
    console.log("[Relay Widget] Survey requested:", surveyId);
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private generateStyles(): string {
    // Helper to scope CSS selectors with #relay-widget
    const scopeCSS = (css: string): string => {
      // First, add #relay-widget prefix to all .relay- selectors
      let scoped = css.replace(/\.relay-/g, "#relay-widget .relay-");
      // Then fix any double-prefixing that might occur
      scoped = scoped.replace(
        /#relay-widget\s+#relay-widget/g,
        "#relay-widget",
      );
      return scoped;
    };

    return `
      ${generateBaseCSS(this.themeMode, this.config.primaryColor)}
      ${generateResponsiveCSS()}
      ${triggerStyles}
      ${modalStyles}
      ${bottomNavStyles}
      ${pageHeaderStyles}
      ${pageStyles}
      ${sharedComponentStyles}
      ${scopeCSS(formComponentStyles)}
      ${scopeCSS(screenshotComponentStyles)}
      ${scopeCSS(chatComponentStyles)}
      ${scopeCSS(roadmapComponentStyles)}
    `;
  }

  private updateTheme(): void {
    const styleEl = this.container?.querySelector("#relay-widget-styles");
    if (styleEl) {
      styleEl.textContent = this.generateStyles();
    }
  }

  private handleClose(): void {
    this.isOpen = false;
    this.trigger?.setOpen(false);
  }

  private handleNavChange(tab: NavTab): void {
    switch (tab) {
      case "home":
        this.navigateTo("home");
        break;
      case "messages":
        this.navigateTo("messages");
        break;
      case "help":
        this.navigateTo("help");
        break;
      case "roadmap":
        this.navigateTo("roadmap");
        break;
    }
  }

  private navigateTo(view: WidgetView): void {
    this.currentView = view;
    this.renderCurrentView();

    // Update bottom nav if on main views
    if (
      view === "home" ||
      view === "messages" ||
      view === "help" ||
      view === "roadmap"
    ) {
      this.bottomNav?.setActiveTab(view as NavTab);
    }

    // Capture screenshot when navigating to bug report
    if (view === "bug-report" && !this.screenshotBlob) {
      this.captureScreenshot();
    }
  }

  private renderCurrentView(): void {
    if (!this.modal) return;

    const contentEl = this.modal.contentEl;
    contentEl.innerHTML = "";

    switch (this.currentView) {
      case "home":
        this.renderHomeView(contentEl);
        break;
      case "messages":
        this.renderMessagesView(contentEl);
        break;
      case "messages-thread":
        this.renderMessageThreadView(contentEl);
        break;
      case "roadmap":
        this.renderRoadmapView(contentEl);
        break;
      case "help":
        this.renderHelpView(contentEl);
        break;
      case "help-article":
        this.renderHelpArticleView(contentEl);
        break;
      case "bug-report":
        this.renderBugReportView(contentEl);
        break;
      case "feature-request":
        this.renderFeatureRequestView(contentEl);
        break;
      default:
        this.renderHomeView(contentEl);
    }
  }

  private renderHomeView(container: HTMLElement): void {
    // Create a wrapper for home content + nav
    const wrapper = createElement("div", {
      class: "relay-view-wrapper",
    });
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Minimal header with just close button
    const header = createElement("div", { class: "relay-page-header" });
    header.style.borderBottom = "none";
    header.style.justifyContent = "flex-end";

    const closeBtn = createElement("button", {
      type: "button",
      class: "relay-page-header__close",
    });
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    // Home page content
    if (!this.homePage) {
      this.homePage = createHomePage({
        greeting: "Hi there!",
        subtitle: "How can we help you today?",
        onChatSubmit: (message) => this.handleChatSubmit(message),
        onReportBug: () => this.navigateTo("bug-report"),
        onRequestFeature: () => this.navigateTo("feature-request"),
      });
    }

    wrapper.appendChild(header);
    wrapper.appendChild(this.homePage.element);
    if (this.bottomNav) {
      wrapper.appendChild(this.bottomNav.element);
    }

    container.appendChild(wrapper);
  }

  private renderMessagesView(container: HTMLElement): void {
    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header
    const header = this.createPageHeader("Messages", false);

    // Content - Conversation list
    const content = createElement("div", { class: "relay-page-content" });

    // Create list with loading state initially
    this.conversationList = createConversationList({
      conversations: [],
      onSelect: (conversation) => {
        this.currentConversation = conversation;
        this.navigateTo("messages-thread");
      },
      loading: true,
    });

    content.appendChild(this.conversationList.element);

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    if (this.bottomNav) {
      wrapper.appendChild(this.bottomNav.element);
    }

    container.appendChild(wrapper);

    // Fetch conversations
    this.fetchConversations();
  }

  private async fetchConversations(): Promise<void> {
    try {
      if (this.useMockData) {
        const conversations = getMockConversations();
        this.conversationList?.setConversations(conversations);
        this.conversationList?.setLoading(false);
        // Update unread badge
        const totalUnread = conversations.reduce(
          (sum, c) => sum + c.unreadCount,
          0,
        );
        this.bottomNav?.setUnreadCount(totalUnread);
      } else {
        const conversations = await this.callbacks.onFetchConversations();
        this.conversationList?.setConversations(
          conversations.map((c) => ({
            id: c.id,
            subject: c.subject || "New conversation",
            lastMessage: c.lastMessage || {
              body: "",
              direction: "inbound" as const,
              createdAt: c.createdAt,
            },
            unreadCount: c.unreadCount,
            createdAt: c.createdAt,
          })),
        );
        this.conversationList?.setLoading(false);
        // Update unread badge
        const totalUnread = conversations.reduce(
          (sum, c) => sum + c.unreadCount,
          0,
        );
        this.bottomNav?.setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error("[Relay] Failed to fetch conversations:", error);
      this.conversationList?.setLoading(false);
      this.showError("Failed to load messages");
    }
  }

  private renderMessageThreadView(container: HTMLElement): void {
    if (!this.currentConversation) {
      this.navigateTo("messages");
      return;
    }

    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header with back button
    const header = this.createPageHeader(
      this.currentConversation.subject || "Conversation",
      true,
      () => {
        this.stopMessagePolling();
        this.currentConversation = null;
        this.navigateTo("messages");
      },
    );

    // Message thread with loading state
    this.messageThread = createMessageThread({
      messages: [],
      hasMore: false,
      loading: true,
    });

    // Chat input
    this.chatInput = createChatInput({
      placeholder: "Type a message...",
      onSend: (message) => this.handleMessageSend(message),
    });

    wrapper.appendChild(header);
    wrapper.appendChild(this.messageThread.element);
    wrapper.appendChild(this.chatInput.element);

    container.appendChild(wrapper);

    // Fetch messages and start polling
    this.fetchMessages();
    this.startMessagePolling();
  }

  private async fetchMessages(): Promise<void> {
    if (!this.currentConversation) return;

    try {
      if (this.useMockData) {
        const messages = getMockMessages(this.currentConversation.id);
        this.messageThread?.setMessages(
          messages.map((m) => ({
            id: m.id,
            body: m.body,
            direction: m.direction,
            createdAt: m.createdAt,
          })),
        );
        this.messageThread?.setLoading(false);
        setTimeout(() => this.messageThread?.scrollToBottom(), 0);
      } else {
        const { messages, hasMore } = await this.callbacks.onFetchMessages(
          this.currentConversation.id,
        );
        this.messageThread?.setMessages(
          messages.map((m) => ({
            id: m.id,
            body: m.body,
            direction: m.direction,
            createdAt: m.createdAt,
          })),
        );
        this.messageThread?.setLoading(false);
        setTimeout(() => this.messageThread?.scrollToBottom(), 0);

        // Mark messages as read
        await this.callbacks.onMarkMessagesRead(this.currentConversation.id);
      }
    } catch (error) {
      console.error("[Relay] Failed to fetch messages:", error);
      this.messageThread?.setLoading(false);
      this.showError("Failed to load messages");
    }
  }

  private startMessagePolling(): void {
    // Poll every 5 seconds for new messages
    this.messagePollingInterval = setInterval(() => {
      if (this.currentConversation && this.currentView === "messages-thread") {
        this.pollForNewMessages();
      }
    }, 5000);
  }

  private stopMessagePolling(): void {
    if (this.messagePollingInterval) {
      clearInterval(this.messagePollingInterval);
      this.messagePollingInterval = null;
    }
  }

  private async pollForNewMessages(): Promise<void> {
    if (!this.currentConversation || this.useMockData) return;

    try {
      const { messages } = await this.callbacks.onFetchMessages(
        this.currentConversation.id,
      );
      // Update thread with new messages (component handles deduplication)
      this.messageThread?.setMessages(
        messages.map((m) => ({
          id: m.id,
          body: m.body,
          direction: m.direction,
          createdAt: m.createdAt,
        })),
      );
    } catch (error) {
      // Silently fail polling - don't show error for background refresh
      console.warn("[Relay] Message polling failed:", error);
    }
  }

  private renderBugReportView(container: HTMLElement): void {
    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header with back button
    const header = this.createPageHeader("Report a Bug", true);

    // Form content
    const content = createElement("div", { class: "relay-page-content" });

    if (!this.bugReportForm) {
      this.bugReportForm = createBugReportForm({
        showSeverity: true,
        showScreenshot: true,
        showLogs: true,
        showAttachments: true,
        onSubmit: (data) => this.handleBugSubmit(data),
        onScreenshotEdit: () => this.openScreenshotEditor(),
        onFormChange: () => this.setFormDirty(true),
      });
    }

    // Update screenshot preview if we have one
    if (this.screenshotBlob) {
      this.bugReportForm.setScreenshotPreview(this.screenshotBlob);
    }

    content.appendChild(this.bugReportForm.element);

    wrapper.appendChild(header);
    wrapper.appendChild(content);

    container.appendChild(wrapper);
  }

  private renderFeatureRequestView(container: HTMLElement): void {
    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header with back button
    const header = this.createPageHeader("Request a Feature", true);

    // Form content
    const content = createElement("div", { class: "relay-page-content" });

    if (!this.featureRequestForm) {
      this.featureRequestForm = createFeatureRequestForm({
        showAttachments: true,
        onSubmit: (data) => this.handleFeatureRequestSubmit(data),
        onFormChange: () => this.setFormDirty(true),
      });
    }

    content.appendChild(this.featureRequestForm.element);

    wrapper.appendChild(header);
    wrapper.appendChild(content);

    container.appendChild(wrapper);
  }

  private renderRoadmapView(container: HTMLElement): void {
    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header
    const header = this.createPageHeader("Roadmap", false);

    // Content - Roadmap list
    const content = createElement("div", { class: "relay-page-content" });

    // Create list with loading state
    this.roadmapList = createRoadmapList({
      items: [],
      onVote: (item) => this.handleRoadmapVote(item),
      loading: true,
      groupByStatus: true,
    });

    content.appendChild(this.roadmapList.element);

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    if (this.bottomNav) {
      wrapper.appendChild(this.bottomNav.element);
    }

    container.appendChild(wrapper);

    // Fetch roadmap items
    this.fetchRoadmap();
  }

  private async fetchRoadmap(): Promise<void> {
    try {
      if (this.useMockData) {
        const items = getMockRoadmap();
        this.roadmapItems = items;
        this.roadmapList?.setItems(items);
        this.roadmapList?.setLoading(false);
      } else {
        const items = await this.callbacks.onFetchRoadmap();
        this.roadmapItems = items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description || "",
          status: item.status,
          voteCount: item.voteCount,
          hasVoted: item.hasVoted,
        }));
        this.roadmapList?.setItems(this.roadmapItems);
        this.roadmapList?.setLoading(false);
      }
    } catch (error) {
      console.error("[Relay] Failed to fetch roadmap:", error);
      this.roadmapList?.setLoading(false);
      this.showError("Failed to load roadmap");
    }
  }

  // ============================================================================
  // Help View
  // ============================================================================

  private renderHelpView(container: HTMLElement): void {
    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header
    const header = this.createPageHeader("Help Center", false);

    // Search bar
    const searchWrapper = createElement("div", { class: "relay-help-search" });
    const searchInner = createElement("div", {
      class: "relay-help-search__wrapper",
    });

    const searchIcon = createElement("span", {
      class: "relay-help-search__icon",
    });
    searchIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`;

    const searchInput = createElement("input", {
      type: "text",
      class: "relay-help-search__input",
      placeholder: "Search articles...",
    }) as HTMLInputElement;
    searchInput.value = this.helpSearchQuery;

    let searchTimeout: ReturnType<typeof setTimeout>;
    searchInput.addEventListener("input", (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.helpSearchQuery = query;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchHelpArticles(query);
      }, 300);
    });

    searchInner.appendChild(searchIcon);
    searchInner.appendChild(searchInput);
    searchWrapper.appendChild(searchInner);

    // Content
    const content = createElement("div", { class: "relay-page-content" });

    // Loading state initially
    const loading = createElement("div", { class: "relay-help-loading" }, [
      "Loading...",
    ]);
    content.appendChild(loading);

    wrapper.appendChild(header);
    wrapper.appendChild(searchWrapper);
    wrapper.appendChild(content);
    if (this.bottomNav) {
      wrapper.appendChild(this.bottomNav.element);
    }

    container.appendChild(wrapper);

    // Fetch help data
    this.fetchHelpData(content);
  }

  private async fetchHelpData(contentEl: HTMLElement): Promise<void> {
    try {
      if (this.useMockData) {
        // Mock data for testing
        this.helpCategories = [
          { id: "1", name: "Getting Started", articleCount: 3 },
          { id: "2", name: "Account & Billing", articleCount: 5 },
          { id: "3", name: "Troubleshooting", articleCount: 4 },
        ];
        this.helpArticles = [
          {
            id: "1",
            slug: "quick-start",
            title: "Quick Start Guide",
            excerpt: "Get up and running in minutes",
          },
          {
            id: "2",
            slug: "installation",
            title: "Installation",
            excerpt: "How to install the SDK",
          },
          {
            id: "3",
            slug: "configuration",
            title: "Configuration Options",
            excerpt: "Customize your setup",
          },
        ];
      } else {
        // Fetch from API
        const [categories, articles] = await Promise.all([
          this.callbacks.onFetchHelpCategories(),
          this.callbacks.onFetchHelpArticles(),
        ]);
        this.helpCategories = categories;
        this.helpArticles = articles;
      }

      this.renderHelpContent(contentEl);
    } catch (error) {
      console.error("[Relay] Failed to fetch help data:", error);
      contentEl.innerHTML = "";
      const errorEl = createElement("div", { class: "relay-empty-state" });
      errorEl.innerHTML = `
        <div class="relay-empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>
        <h3 class="relay-empty-state__title">Unable to load help</h3>
        <p class="relay-empty-state__text">Please try again later</p>
      `;
      contentEl.appendChild(errorEl);
    }
  }

  private renderHelpContent(contentEl: HTMLElement): void {
    contentEl.innerHTML = "";

    // If searching, show search results
    if (this.helpSearchQuery) {
      const articlesSection = createElement("div", {
        class: "relay-help-articles",
      });
      const title = createElement("h3", { class: "relay-help-section-title" }, [
        "Search Results",
      ]);
      contentEl.appendChild(title);

      if (this.helpArticles.length === 0) {
        const empty = createElement("div", { class: "relay-empty-state" });
        empty.innerHTML = `
          <div class="relay-empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
          <h3 class="relay-empty-state__title">No results found</h3>
          <p class="relay-empty-state__text">Try a different search term</p>
        `;
        articlesSection.appendChild(empty);
      } else {
        this.helpArticles.forEach((article) => {
          const item = this.createArticleItem(article);
          articlesSection.appendChild(item);
        });
      }

      contentEl.appendChild(articlesSection);
      return;
    }

    // Show categories if any
    if (this.helpCategories.length > 0) {
      const categoriesSection = createElement("div", {
        class: "relay-help-categories",
      });
      const title = createElement("h3", { class: "relay-help-section-title" }, [
        "Categories",
      ]);
      contentEl.appendChild(title);

      this.helpCategories.forEach((category) => {
        const item = createElement("div", { class: "relay-help-category" });
        item.innerHTML = `
          <h4 class="relay-help-category__name">${this.escapeHtml(category.name)}</h4>
          <span class="relay-help-category__count">${category.articleCount} articles</span>
        `;
        item.addEventListener("click", () => {
          this.filterArticlesByCategory(category.id, contentEl);
        });
        categoriesSection.appendChild(item);
      });

      contentEl.appendChild(categoriesSection);
    }

    // Show popular/recent articles
    if (this.helpArticles.length > 0) {
      const articlesSection = createElement("div", {
        class: "relay-help-articles",
      });
      const title = createElement("h3", { class: "relay-help-section-title" }, [
        "Popular Articles",
      ]);
      contentEl.appendChild(title);

      this.helpArticles.slice(0, 5).forEach((article) => {
        const item = this.createArticleItem(article);
        articlesSection.appendChild(item);
      });

      contentEl.appendChild(articlesSection);
    }

    // Empty state if no content
    if (this.helpCategories.length === 0 && this.helpArticles.length === 0) {
      const empty = createElement("div", { class: "relay-empty-state" });
      empty.innerHTML = `
        <div class="relay-empty-state__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></div>
        <h3 class="relay-empty-state__title">No help articles yet</h3>
        <p class="relay-empty-state__text">Check back soon</p>
      `;
      contentEl.appendChild(empty);
    }
  }

  private createArticleItem(article: ApiHelpArticle): HTMLElement {
    const item = createElement("button", {
      type: "button",
      class: "relay-help-article-item",
    });
    item.innerHTML = `
      <h4 class="relay-help-article-item__title">${this.escapeHtml(article.title)}</h4>
      ${article.excerpt ? `<p class="relay-help-article-item__excerpt">${this.escapeHtml(article.excerpt)}</p>` : ""}
    `;
    item.addEventListener("click", () => {
      this.openHelpArticle(article.slug);
    });
    return item;
  }

  private async searchHelpArticles(query: string): Promise<void> {
    if (!query.trim()) {
      // Reset to default view
      const contentEl = this.modal?.contentEl.querySelector(
        ".relay-page-content",
      ) as HTMLElement;
      if (contentEl) {
        await this.fetchHelpData(contentEl);
      }
      return;
    }

    try {
      if (this.useMockData) {
        // Filter mock articles
        this.helpArticles = [
          {
            id: "1",
            slug: "quick-start",
            title: "Quick Start Guide",
            excerpt: "Get up and running in minutes",
          },
        ].filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));
      } else {
        this.helpArticles = await this.callbacks.onSearchHelpArticles(query);
      }

      const contentEl = this.modal?.contentEl.querySelector(
        ".relay-page-content",
      ) as HTMLElement;
      if (contentEl) {
        this.renderHelpContent(contentEl);
      }
    } catch (error) {
      console.error("[Relay] Help search failed:", error);
    }
  }

  private async filterArticlesByCategory(
    categoryId: string,
    contentEl: HTMLElement,
  ): Promise<void> {
    try {
      if (!this.useMockData) {
        this.helpArticles =
          await this.callbacks.onFetchHelpArticles(categoryId);
      }
      this.renderHelpContent(contentEl);
    } catch (error) {
      console.error("[Relay] Failed to filter articles:", error);
    }
  }

  private async openHelpArticle(slug: string): Promise<void> {
    try {
      if (this.useMockData) {
        this.currentHelpArticle = {
          id: "1",
          slug: slug,
          title: "Sample Article",
          content:
            "This is a sample help article content.\n\nIt can have multiple paragraphs.",
        };
      } else {
        const article = await this.callbacks.onFetchHelpArticle(slug);
        if (!article) {
          this.showError("Article not found");
          return;
        }
        this.currentHelpArticle = article;
      }

      this.navigateTo("help-article");
    } catch (error) {
      console.error("[Relay] Failed to load article:", error);
      this.showError("Failed to load article");
    }
  }

  private renderHelpArticleView(container: HTMLElement): void {
    if (!this.currentHelpArticle) {
      this.navigateTo("help");
      return;
    }

    const wrapper = createElement("div");
    wrapper.style.cssText =
      "display: flex; flex-direction: column; height: 100%;";

    // Header with back button
    const header = this.createPageHeader("Help", true, () => {
      this.currentHelpArticle = null;
      this.navigateTo("help");
    });

    // Article content
    const content = createElement("div", { class: "relay-page-content" });
    const articleContent = createElement("div", {
      class: "relay-help-article-content",
    });

    const title = createElement("h1", {}, [this.currentHelpArticle.title]);
    articleContent.appendChild(title);

    const body = createElement("div", { class: "relay-article-body" });
    if (this.currentHelpArticle.contentHtml) {
      body.innerHTML = this.currentHelpArticle.contentHtml;
    } else if (this.currentHelpArticle.content) {
      // Convert plain text to HTML paragraphs
      body.innerHTML = this.currentHelpArticle.content
        .split("\n\n")
        .map((p) => `<p>${this.escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
    }
    articleContent.appendChild(body);

    content.appendChild(articleContent);
    wrapper.appendChild(header);
    wrapper.appendChild(content);

    container.appendChild(wrapper);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private createPageHeader(
    title: string,
    showBack: boolean,
    onBack?: () => void,
  ): HTMLElement {
    const header = createElement("div", { class: "relay-page-header" });

    if (showBack) {
      const backBtn = createElement("button", {
        type: "button",
        class: "relay-page-header__back",
      });
      backBtn.innerHTML = BACK_ICON;
      backBtn.setAttribute("aria-label", "Go back");
      backBtn.addEventListener("click", () => {
        // Check for unsaved changes
        if (!this.confirmDiscard()) return;
        this.formDirty = false;

        if (onBack) {
          onBack();
        } else {
          this.navigateTo("home");
        }
      });
      header.appendChild(backBtn);
    }

    const titleEl = createElement("h2", { class: "relay-page-header__title" }, [
      title,
    ]);
    header.appendChild(titleEl);

    const closeBtn = createElement("button", {
      type: "button",
      class: "relay-page-header__close",
    });
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    return header;
  }

  private async captureScreenshot(): Promise<void> {
    try {
      // Hide widget before capturing
      if (this.container) {
        this.container.style.visibility = "hidden";
      }

      // Small delay to ensure widget is hidden
      await new Promise((resolve) => setTimeout(resolve, 50));

      const blob = await this.callbacks.onScreenshotCapture();

      // Show widget again
      if (this.container) {
        this.container.style.visibility = "visible";
      }

      if (blob) {
        this.screenshotBlob = blob;
        this.bugReportForm?.setScreenshotPreview(blob);
      }
    } catch (error) {
      console.warn("[Relay] Screenshot capture failed:", error);
      if (this.container) {
        this.container.style.visibility = "visible";
      }
    }
  }

  private openScreenshotEditor(): void {
    if (!this.screenshotBlob) return;

    this.screenshotEditor = createScreenshotEditor({
      screenshot: this.screenshotBlob,
      existingAnnotations: this.annotations,
      onSave: (annotatedBlob, annotations) => {
        this.screenshotBlob = annotatedBlob;
        this.annotations = annotations;
        this.bugReportForm?.setScreenshotPreview(annotatedBlob);
      },
      onCancel: () => {
        this.screenshotEditor = null;
      },
    });

    this.screenshotEditor.open();
  }

  private async handleChatSubmit(message: string): Promise<void> {
    try {
      if (this.useMockData) {
        // Create a new mock conversation
        const conversation = createMockConversation(
          message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          message,
        );
        this.currentConversation = {
          id: conversation.id,
          subject: conversation.subject,
          lastMessage: conversation.lastMessage,
          unreadCount: conversation.unreadCount,
          createdAt: conversation.createdAt,
        };
        // Navigate to the thread view
        this.navigateTo("messages-thread");
      } else {
        // Start a real conversation via API
        const result = await this.callbacks.onStartConversation(message);
        this.currentConversation = {
          id: result.conversationId,
          subject:
            message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          lastMessage: {
            body: message,
            direction: "inbound",
            createdAt: new Date().toISOString(),
          },
          unreadCount: 0,
          createdAt: new Date().toISOString(),
        };
        // Navigate to the thread view
        this.navigateTo("messages-thread");
      }
    } catch (error) {
      console.error("[Relay] Chat message failed:", error);
      this.showError("Failed to start conversation");
    }
  }

  private async handleBugSubmit(data: BugReportFormData): Promise<void> {
    try {
      await this.callbacks.onBugSubmit({
        ...data,
        screenshotBlob: data.includeScreenshot
          ? this.screenshotBlob || undefined
          : undefined,
        annotations: this.annotations,
      });

      this.formDirty = false;
      this.bugReportForm?.showSuccess();

      // Reset after delay and go back home
      setTimeout(() => {
        this.bugReportForm?.reset();
        this.screenshotBlob = null;
        this.annotations = [];
        this.navigateTo("home");
      }, 2000);
    } catch (error) {
      console.error("[Relay] Bug report submission failed:", error);
      this.showError("Failed to submit bug report. Please try again.");
    }
  }

  private async handleFeedbackSubmit(data: FeedbackFormData): Promise<void> {
    try {
      await this.callbacks.onFeedbackSubmit(data);
      this.formDirty = false;
      this.feedbackForm?.showSuccess();

      // Reset after delay and go back home
      setTimeout(() => {
        this.feedbackForm?.reset();
        this.navigateTo("home");
      }, 2000);
    } catch (error) {
      console.error("[Relay] Feedback submission failed:", error);
      this.showError("Failed to submit feedback. Please try again.");
    }
  }

  private async handleFeatureRequestSubmit(
    data: FeatureRequestFormData,
  ): Promise<void> {
    try {
      await this.callbacks.onFeatureRequestSubmit(data);
      this.formDirty = false;
      this.featureRequestForm?.showSuccess();

      // Reset after delay and go back home
      setTimeout(() => {
        this.featureRequestForm?.reset();
        this.navigateTo("home");
      }, 2000);
    } catch (error) {
      console.error("[Relay] Feature request submission failed:", error);
      this.showError("Failed to submit feature request. Please try again.");
    }
  }

  private async handleMessageSend(message: string): Promise<void> {
    if (!this.currentConversation) return;

    // Optimistically add message to UI
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      body: message,
      direction: "inbound",
      createdAt: new Date().toISOString(),
    };
    this.messageThread?.addMessage(tempMessage);
    this.chatInput?.clear();

    try {
      if (this.useMockData) {
        // Add message to mock data
        addMockMessage(this.currentConversation.id, message);
      } else {
        // Call real API
        await this.callbacks.onSendMessage(
          this.currentConversation.id,
          message,
        );
      }
    } catch (error) {
      console.error("[Relay] Message send failed:", error);
      this.showError("Failed to send message");
      // Could remove the optimistic message here, but keeping it for now
    }
  }

  private async handleRoadmapVote(item: RoadmapItemData): Promise<void> {
    // Optimistic update
    const updatedItem: RoadmapItemData = {
      ...item,
      hasVoted: !item.hasVoted,
      voteCount: item.voteCount + (item.hasVoted ? -1 : 1),
    };
    this.roadmapList?.updateItem(updatedItem);

    // Update local state
    const index = this.roadmapItems.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      this.roadmapItems[index] = updatedItem;
    }

    try {
      if (this.useMockData) {
        toggleMockVote(item.id);
      } else {
        // Call real API
        if (item.hasVoted) {
          await this.callbacks.onUnvote(item.id);
        } else {
          await this.callbacks.onVote(item.id);
        }
      }
    } catch (error) {
      console.error("[Relay] Vote failed:", error);
      // Revert optimistic update
      this.roadmapList?.updateItem(item);
      if (index !== -1) {
        this.roadmapItems[index] = item;
      }
      this.showError("Failed to update vote");
    }
  }

  // ============================================================================
  // Error handling
  // ============================================================================

  private showError(message: string): void {
    this.lastError = message;
    console.error("[Relay]", message);
    this.showToast(message, "error");
  }

  private showToast(
    message: string,
    type: "error" | "success" = "error",
  ): void {
    if (!this.modal) return;

    // Remove any existing toast
    const existingToast = this.modal.contentEl.querySelector(".relay-toast");
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast
    const toast = createElement(
      "div",
      {
        class: `relay-toast ${type === "success" ? "relay-toast--success" : ""}`,
      },
      [message],
    );

    this.modal.contentEl.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.classList.add("relay-toast--exit");
      setTimeout(() => toast.remove(), 150);
    }, 3000);
  }

  // ============================================================================
  // Form dirty state and discard confirmation
  // ============================================================================

  private setFormDirty(dirty: boolean): void {
    this.formDirty = dirty;
  }

  private confirmDiscard(): boolean {
    if (!this.formDirty) return true;
    return window.confirm(
      "You have unsaved changes. Are you sure you want to leave?",
    );
  }
}

/**
 * Creates and returns a new Widget instance
 */
export function createWidget(options: WidgetOptions): Widget {
  return new Widget(options);
}
