// ============================================================================
// RELAY WEB SDK - Main Entry Point
// ============================================================================

import type {
  RelayConfig,
  RelayUser,
  RelayInstance,
  BugReportData,
  FeedbackData,
  TechnicalContext,
  PrivacyConfig,
  RelayEventType,
  RelayEventHandler,
  Annotation,
} from "./types";
import { ApiClient } from "./utils/api";
import { createConsoleCapture } from "./capture/console";
import { createNetworkCapture } from "./capture/network";
import { createErrorCapture } from "./capture/errors";
import { createReplayCapture } from "./capture/replay";
import { captureScreenshot, applyAnnotations } from "./capture/screenshot";
import { Widget, type WidgetView } from "./ui";

// Re-export types
export * from "./types";

// Prefill data interface
interface PrefillData {
  title?: string;
  description?: string;
  email?: string;
  category?: string;
  tags?: string[];
}

class RelaySDK implements RelayInstance {
  private config: RelayConfig | null = null;
  private api: ApiClient | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private initialized = false;

  // Capture modules
  private consoleCapture = createConsoleCapture();
  private networkCapture = createNetworkCapture();
  private errorCapture = createErrorCapture();
  private replayCapture: ReturnType<typeof createReplayCapture> | null = null;
  private replayId: string | null = null;

  // Event handlers
  private eventHandlers: Map<RelayEventType, Set<RelayEventHandler>> =
    new Map();

  // Session heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  // Widget state
  private widgetOpen = false;
  private widgetContainer: HTMLElement | null = null;
  private widget: Widget | null = null;

  // Prefill data
  private prefillData: PrefillData = {};

  // Custom data
  private customData: Record<string, unknown> = {};

  async init(config: RelayConfig): Promise<void> {
    if (this.initialized) {
      console.warn("[Relay] Already initialized");
      return;
    }

    this.config = config;

    // Create widget immediately (before API calls that might fail)
    if (config.widget?.autoShow !== false) {
      this.createWidget();
    }

    // Start captures based on config (these don't need API)
    const captureConfig = config.capture || {
      console: true,
      network: true,
      dom: true,
      replay: false,
    };

    if (captureConfig.console) {
      this.consoleCapture.start();
    }
    if (captureConfig.network) {
      this.networkCapture.start();
    }
    if (captureConfig.dom) {
      this.errorCapture.start();
    }

    // Initialize API client
    this.api = new ApiClient({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      regionHint: config.regionHint,
    });

    // Create or resume session
    const device = this.getDeviceInfo();
    const result = await this.api.createSession({
      id: config.session?.id,
      userId: config.user?.id,
      device,
      appVersion: config.appVersion,
      environment: config.environment || "production",
      userAgent: navigator.userAgent,
    });

    this.sessionId = result.sessionId;
    this.api.setSessionId(this.sessionId);

    // Identify user if provided
    if (config.user) {
      await this.identify(config.user);
    }

    // Start session heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.api?.updateSession(this.sessionId!);
    }, 60000); // Every minute

    this.initialized = true;
    this.emit("ready");

    if (config.debug) {
      console.log("[Relay] Initialized", { sessionId: this.sessionId });
    }
  }

  async identify(user: RelayUser): Promise<void> {
    if (!this.api || !this.sessionId) {
      throw new Error("Relay not initialized");
    }

    const result = await this.api.identify({
      sessionId: this.sessionId,
      userId: user.id,
      email: user.email,
      name: user.name,
      traits: user.traits,
    });

    this.userId = result.userId;
  }

  setSessionAttributes(attrs: Record<string, unknown>): void {
    // Store session attributes for use in tracking
    if (this.config) {
      this.config.session = {
        ...this.config.session,
        attributes: { ...this.config.session?.attributes, ...attrs },
      };
    }
  }

  open(view?: "bug" | "feedback" | "chat" | WidgetView): void {
    // Map legacy view names to new structure
    let mappedView: WidgetView | undefined;
    if (view === "bug") {
      mappedView = "bug-report";
    } else if (view === "feedback") {
      mappedView = "feature-request";
    } else if (view === "chat") {
      mappedView = "messages";
    } else {
      mappedView = view;
    }
    this.openWidget(mappedView);
    this.emit("open");
  }

  close(): void {
    this.closeWidget();
    this.emit("close");
  }

  /**
   * Prefill form data for the next submission
   * Data is cleared after a successful submission
   */
  prefill(data: PrefillData): void {
    this.prefillData = { ...this.prefillData, ...data };
    if (this.widget) {
      this.widget.setPrefillData(this.prefillData);
    }
  }

  /**
   * Clear prefill data
   */
  clearPrefill(): void {
    this.prefillData = {};
    if (this.widget) {
      this.widget.setPrefillData({});
    }
  }

  /**
   * Set custom data that will be attached to all interactions
   */
  setCustomData(key: string, value: unknown): void {
    this.customData[key] = value;
  }

  /**
   * Get all custom data
   */
  getCustomData(): Record<string, unknown> {
    return { ...this.customData };
  }

  /**
   * Clear a specific custom data key
   */
  clearCustomData(key: string): void {
    delete this.customData[key];
  }

  /**
   * Clear all custom data
   */
  clearAllCustomData(): void {
    this.customData = {};
  }

  /**
   * Show a specific survey by ID
   */
  async showSurvey(surveyId: string): Promise<void> {
    if (!this.api || !this.sessionId) return;

    try {
      const surveys = (await this.api.getActiveSurveys({
        sessionId: this.sessionId,
        userId: this.userId || undefined,
        url: window.location.href,
      })) as any[];

      const survey = surveys.find((s: any) => s.id === surveyId);
      if (survey) {
        this.renderSurvey(survey);
      }
    } catch (error) {
      console.error("[Relay] Failed to show survey:", error);
    }
  }

  /**
   * Check and show eligible surveys (called after page load or events)
   */
  async checkForSurveys(triggerEvent?: string): Promise<void> {
    if (!this.api || !this.sessionId) return;

    try {
      const surveys = (await this.api.getActiveSurveys({
        sessionId: this.sessionId,
        userId: this.userId || undefined,
        url: window.location.href,
        traits: this.customData,
      } as any)) as any[];

      // Show the first eligible survey
      if (surveys.length > 0) {
        // Check localStorage for shown surveys
        const shownSurveys = this.getShownSurveys();
        const survey = surveys.find((s: any) => {
          const targeting = s.targeting as any;
          if (targeting?.showOnce && shownSurveys.includes(s.id)) {
            return false;
          }
          return true;
        });

        if (survey) {
          // Apply showAfterSeconds delay if configured
          const targeting = survey.targeting as any;
          const delay = (targeting?.showAfterSeconds || 0) * 1000;

          setTimeout(() => {
            this.renderSurvey(survey);
          }, delay);
        }
      }
    } catch (error) {
      console.warn("[Relay] Failed to check for surveys:", error);
    }
  }

  private getShownSurveys(): string[] {
    try {
      const stored = localStorage.getItem("relay_shown_surveys");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private markSurveyShown(surveyId: string): void {
    try {
      const shown = this.getShownSurveys();
      if (!shown.includes(surveyId)) {
        shown.push(surveyId);
        localStorage.setItem("relay_shown_surveys", JSON.stringify(shown));
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private renderSurvey(survey: any): void {
    // Mark as shown
    this.markSurveyShown(survey.id);

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "relay-survey-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const definition = survey.definition as any;
    let currentQuestion = 0;
    const responses: Record<string, unknown> = {};

    const renderContent = () => {
      modal.innerHTML = "";

      const header = document.createElement("div");
      header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        position: relative;
      `;

      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      closeBtn.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        padding: 0;
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeBtn.onclick = () => overlay.remove();

      const title = document.createElement("h2");
      title.textContent = definition.title;
      title.style.cssText = `
        font-size: 18px;
        font-weight: 600;
        color: #111827;
        margin: 0 0 4px;
        padding-right: 32px;
      `;

      header.appendChild(closeBtn);
      header.appendChild(title);
      modal.appendChild(header);

      // Question content
      const content = document.createElement("div");
      content.style.cssText = `padding: 24px;`;

      const question = definition.questions[currentQuestion];
      if (question) {
        const questionText = document.createElement("p");
        questionText.textContent = question.text;
        questionText.style.cssText = `
          font-size: 15px;
          font-weight: 500;
          color: #111827;
          margin: 0 0 16px;
        `;
        content.appendChild(questionText);

        // Render based on question type
        if (question.type === "nps") {
          const scale = document.createElement("div");
          scale.style.cssText = `display: flex; gap: 4px;`;

          for (let i = 0; i <= 10; i++) {
            const btn = document.createElement("button");
            btn.textContent = String(i);
            btn.style.cssText = `
              flex: 1;
              padding: 12px 0;
              background: ${responses[question.id] === i ? "#3b82f6" : "#f3f4f6"};
              border: 1px solid ${responses[question.id] === i ? "#3b82f6" : "#e5e7eb"};
              border-radius: 8px;
              font-family: inherit;
              font-size: 14px;
              font-weight: 500;
              color: ${responses[question.id] === i ? "white" : "#111827"};
              cursor: pointer;
            `;
            btn.onclick = () => {
              responses[question.id] = i;
              renderContent();
            };
            scale.appendChild(btn);
          }
          content.appendChild(scale);

          const labels = document.createElement("div");
          labels.style.cssText = `display: flex; justify-content: space-between; margin-top: 8px;`;
          const minLabel = document.createElement("span");
          minLabel.textContent = question.minLabel || "Not likely";
          minLabel.style.cssText = `font-size: 12px; color: #6b7280;`;
          const maxLabel = document.createElement("span");
          maxLabel.textContent = question.maxLabel || "Very likely";
          maxLabel.style.cssText = `font-size: 12px; color: #6b7280;`;
          labels.appendChild(minLabel);
          labels.appendChild(maxLabel);
          content.appendChild(labels);
        } else if (question.type === "text") {
          const textarea = document.createElement("textarea");
          textarea.placeholder = question.placeholder || "Your answer...";
          textarea.value = (responses[question.id] as string) || "";
          textarea.style.cssText = `
            width: 100%;
            padding: 12px 14px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            font-family: inherit;
            font-size: 14px;
            color: #111827;
            resize: vertical;
            min-height: 100px;
            box-sizing: border-box;
          `;
          textarea.oninput = () => {
            responses[question.id] = textarea.value;
          };
          content.appendChild(textarea);
        } else if (question.type === "rating") {
          const ratingContainer = document.createElement("div");
          ratingContainer.style.cssText = `display: flex; gap: 8px;`;
          const max = question.max || 5;
          for (let i = 1; i <= max; i++) {
            const star = document.createElement("button");
            star.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="${i <= (responses[question.id] as number || 0) ? "#f59e0b" : "#e5e7eb"}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
            star.style.cssText = `
              padding: 8px;
              background: none;
              border: none;
              cursor: pointer;
            `;
            star.onclick = () => {
              responses[question.id] = i;
              renderContent();
            };
            ratingContainer.appendChild(star);
          }
          content.appendChild(ratingContainer);
        } else if (question.type === "single_choice" || question.type === "multi_choice") {
          const choices = document.createElement("div");
          choices.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;

          (question.options || []).forEach((option: string) => {
            const isMulti = question.type === "multi_choice";
            const selected = isMulti
              ? ((responses[question.id] as string[]) || []).includes(option)
              : responses[question.id] === option;

            const choice = document.createElement("div");
            choice.style.cssText = `
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px 14px;
              background: ${selected ? "rgba(59, 130, 246, 0.05)" : "#f9fafb"};
              border: 1px solid ${selected ? "#3b82f6" : "#e5e7eb"};
              border-radius: 10px;
              cursor: pointer;
            `;

            const indicator = document.createElement("div");
            indicator.style.cssText = `
              width: 18px;
              height: 18px;
              border: 2px solid ${selected ? "#3b82f6" : "#e5e7eb"};
              border-radius: ${isMulti ? "4px" : "50%"};
              background: ${selected ? "#3b82f6" : "transparent"};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 12px;
            `;
            if (selected) {
              indicator.textContent = isMulti ? "\u2713" : "";
            }

            const text = document.createElement("span");
            text.textContent = option;
            text.style.cssText = `font-size: 14px; color: #111827;`;

            choice.appendChild(indicator);
            choice.appendChild(text);

            choice.onclick = () => {
              if (isMulti) {
                const current = ((responses[question.id] as string[]) || []).slice();
                const idx = current.indexOf(option);
                if (idx >= 0) {
                  current.splice(idx, 1);
                } else {
                  current.push(option);
                }
                responses[question.id] = current;
              } else {
                responses[question.id] = option;
              }
              renderContent();
            };

            choices.appendChild(choice);
          });

          content.appendChild(choices);
        }
      }

      modal.appendChild(content);

      // Footer
      const footer = document.createElement("div");
      footer.style.cssText = `padding: 16px 24px 24px; display: flex; gap: 12px;`;

      if (currentQuestion > 0) {
        const backBtn = document.createElement("button");
        backBtn.textContent = "Back";
        backBtn.style.cssText = `
          flex: 1;
          padding: 12px 20px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          cursor: pointer;
        `;
        backBtn.onclick = () => {
          currentQuestion--;
          renderContent();
        };
        footer.appendChild(backBtn);
      }

      const isLast = currentQuestion === definition.questions.length - 1;
      const nextBtn = document.createElement("button");
      nextBtn.textContent = isLast ? "Submit" : "Next";
      nextBtn.style.cssText = `
        flex: 1;
        padding: 12px 20px;
        background: #3b82f6;
        border: none;
        border-radius: 10px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        color: white;
        cursor: pointer;
      `;
      nextBtn.onclick = async () => {
        if (isLast) {
          nextBtn.disabled = true;
          nextBtn.textContent = "Submitting...";
          try {
            await this.api?.submitSurveyResponse({
              surveyId: survey.id,
              sessionId: this.sessionId!,
              responses,
            });
            // Show thank you
            modal.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center;">
                <div style="width: 56px; height: 56px; margin-bottom: 16px; color: #10b981; background: rgba(16, 185, 129, 0.1); border-radius: 50%; padding: 12px;">
                  <svg viewBox="0 0 24 24" fill="currentColor" style="width: 100%; height: 100%;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
                <h4 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 6px;">Thank you!</h4>
                <p style="font-size: 14px; color: #6b7280; margin: 0;">${definition.thankYouMessage || "Your feedback has been submitted."}</p>
              </div>
            `;
            setTimeout(() => overlay.remove(), 2000);
          } catch (error) {
            nextBtn.disabled = false;
            nextBtn.textContent = "Submit";
            console.error("[Relay] Survey submission failed:", error);
          }
        } else {
          currentQuestion++;
          renderContent();
        }
      };
      footer.appendChild(nextBtn);

      modal.appendChild(footer);
    };

    renderContent();
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    };
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Check if the SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  async captureBug(data: BugReportData): Promise<string> {
    if (!this.api || !this.sessionId) {
      throw new Error("Relay not initialized");
    }

    const context = this.getTechnicalContext();
    let screenshotBlob: Blob | undefined;

    // Capture screenshot if requested
    if (data.includeScreenshot !== false) {
      try {
        const result = await captureScreenshot({
          maskSelectors: this.config?.privacy?.maskSelectors,
          blockSelectors: this.config?.privacy?.blockSelectors,
        });
        screenshotBlob = result.blob;
      } catch (error) {
        console.warn("[Relay] Screenshot capture failed:", error);
      }
    }

    // Create interaction
    const { interactionId } = await this.api.createInteraction({
      type: "bug",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      contentText: data.description,
      content: {
        title: data.title,
        description: data.description,
        tags: data.tags,
      },
      severity: data.severity,
      tags: data.tags,
      technicalContext: context,
    });

    // Store logs if requested
    if (data.includeLogs !== false) {
      const consoleLogs = this.consoleCapture.getEntries();
      const networkLogs = this.networkCapture.getEntries();
      const errors = this.errorCapture.getEntries();

      if (
        consoleLogs.length > 0 ||
        networkLogs.length > 0 ||
        errors.length > 0
      ) {
        await this.api.storeLogs({
          interactionId,
          console: consoleLogs,
          network: networkLogs,
          errors,
        });
      }
    }

    // Upload screenshot
    if (screenshotBlob) {
      await this.uploadMedia(interactionId, "screenshot", screenshotBlob);
    }

    // Upload attachments
    if (data.attachments) {
      for (const file of data.attachments) {
        await this.uploadMedia(interactionId, "attachment", file);
      }
    }

    this.emit("bug:submitted", { interactionId });

    return interactionId;
  }

  async captureFeedback(data: FeedbackData): Promise<string> {
    if (!this.api || !this.sessionId) {
      throw new Error("Relay not initialized");
    }

    const context = this.getTechnicalContext();

    const { interactionId } = await this.api.createInteraction({
      type: "feedback",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      contentText: data.text,
      content: {
        category: data.category,
        rating: data.rating,
        tags: data.tags,
      },
      tags: data.tags,
      technicalContext: context,
    });

    this.emit("feedback:submitted", { interactionId });

    return interactionId;
  }

  startRecording(): void {
    if (!this.api || !this.sessionId) {
      throw new Error("Relay not initialized");
    }

    if (this.replayCapture?.isRecording()) {
      console.warn("[Relay] Already recording");
      return;
    }

    // Create replay capture with chunk handler
    this.replayCapture = createReplayCapture(async (events, chunkIndex) => {
      if (!this.replayId || !this.api) return;

      try {
        // Get upload URL and upload chunk
        const { uploadUrl } = await this.api.sendReplayChunk({
          replayId: this.replayId,
          chunkIndex,
          events,
          startTime: events[0]?.timestamp || Date.now(),
          endTime: events[events.length - 1]?.timestamp || Date.now(),
        });

        // Upload chunk data
        await fetch(uploadUrl, {
          method: "PUT",
          body: JSON.stringify(events),
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[Relay] Failed to upload replay chunk:", error);
      }
    });

    // Start replay on server
    this.api.startReplay(this.sessionId).then(({ replayId }) => {
      this.replayId = replayId;
      this.replayCapture?.start({
        maskTextSelector: this.config?.privacy?.maskSelectors?.join(", "),
        blockSelector: this.config?.privacy?.blockSelectors?.join(", "),
      });
      this.emit("replay:started", { replayId });
    });
  }

  async stopRecording(): Promise<void> {
    if (!this.replayCapture?.isRecording() || !this.replayId || !this.api) {
      return;
    }

    const events = await this.replayCapture.stop();

    // End replay on server
    await this.api.endReplay(this.replayId, events.length);

    this.emit("replay:stopped", { replayId: this.replayId });
    this.replayId = null;
  }

  setPrivacy(config: PrivacyConfig): void {
    if (this.config) {
      this.config.privacy = { ...this.config.privacy, ...config };
    }
  }

  track(event: string, properties?: Record<string, unknown>): void {
    if (!this.api || !this.sessionId) {
      console.warn("[Relay] Not initialized, cannot track event");
      return;
    }

    this.api.track(this.sessionId, event, properties);
  }

  on(event: RelayEventType, handler: RelayEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: RelayEventType, handler: RelayEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  destroy(): void {
    // Stop captures
    this.consoleCapture.stop();
    this.networkCapture.stop();
    this.errorCapture.stop();
    this.replayCapture?.stop();

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Remove widget
    if (this.widget) {
      this.widget.unmount();
      this.widget = null;
    }
    if (this.widgetContainer) {
      this.widgetContainer.remove();
      this.widgetContainer = null;
    }

    this.initialized = false;
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private emit(event: RelayEventType, data?: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error("[Relay] Event handler error:", error);
      }
    });
  }

  private getTechnicalContext(): TechnicalContext {
    const nav = navigator as any;

    return {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      devicePixelRatio: window.devicePixelRatio,
      memory: (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          }
        : undefined,
      connection: nav.connection
        ? {
            effectiveType: nav.connection.effectiveType,
            downlink: nav.connection.downlink,
            rtt: nav.connection.rtt,
          }
        : undefined,
      timestamp: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    };
  }

  private getDeviceInfo(): Record<string, unknown> {
    const ua = navigator.userAgent;

    return {
      type: /mobile/i.test(ua)
        ? "mobile"
        : /tablet/i.test(ua)
          ? "tablet"
          : "desktop",
      os: this.detectOS(ua),
      browser: this.detectBrowser(ua),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  private detectOS(ua: string): string {
    if (/windows/i.test(ua)) return "Windows";
    if (/macintosh|mac os x/i.test(ua)) return "macOS";
    if (/linux/i.test(ua)) return "Linux";
    if (/android/i.test(ua)) return "Android";
    if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
    return "Unknown";
  }

  private detectBrowser(ua: string): string {
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) return "Chrome";
    if (/firefox/i.test(ua)) return "Firefox";
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
    if (/edge/i.test(ua)) return "Edge";
    return "Unknown";
  }

  private async uploadMedia(
    interactionId: string,
    kind: string,
    data: Blob | File,
  ): Promise<void> {
    if (!this.api) return;

    const contentType = data.type || "application/octet-stream";
    const filename = data instanceof File ? data.name : undefined;

    const { mediaId, uploadUrl } = await this.api.initiateUpload({
      interactionId,
      kind,
      contentType,
      sizeBytes: data.size,
      filename,
    });

    // Upload to presigned URL
    await fetch(uploadUrl, {
      method: "PUT",
      body: data,
      headers: { "Content-Type": contentType },
    });

    await this.api.completeUpload(mediaId);
  }

  // ============================================================================
  // Widget UI (Modular Implementation)
  // ============================================================================

  private createWidget(): void {
    if (this.widget) return;

    this.widget = new Widget({
      config: this.config?.widget || {},
      themeMode: "auto",
      useMockData: this.config?.widget?.useMockData ?? false,
      callbacks: {
        // Form submissions
        onBugSubmit: async (data) => {
          // Apply annotations to screenshot if any
          let finalScreenshot = data.screenshotBlob;
          if (
            finalScreenshot &&
            data.annotations &&
            data.annotations.length > 0
          ) {
            finalScreenshot = await applyAnnotations(
              finalScreenshot,
              data.annotations,
            );
          }

          await this.captureBugFromWidget({
            title: data.title,
            description: data.description,
            severity: data.severity,
            includeScreenshot: data.includeScreenshot,
            includeLogs: data.includeLogs,
            attachments: data.attachments,
            screenshotBlob: finalScreenshot,
          });
        },
        onFeedbackSubmit: async (data) => {
          await this.captureFeedback({
            text: data.text,
            category: data.category,
            rating: data.rating,
          });
        },
        onFeatureRequestSubmit: async (data) => {
          await this.captureFeatureRequestFromWidget({
            title: data.title,
            description: data.description,
            category: data.category,
            attachments: data.attachments,
          });
        },
        onScreenshotCapture: async () => {
          try {
            const result = await captureScreenshot({
              maskSelectors: this.config?.privacy?.maskSelectors,
              blockSelectors: this.config?.privacy?.blockSelectors,
            });
            return result.blob;
          } catch (error) {
            console.warn("[Relay] Screenshot capture failed:", error);
            return null;
          }
        },

        // Chat API
        onFetchConversations: async () => {
          if (!this.api || !this.sessionId) return [];
          const conversations = await this.api.getConversations(this.sessionId);
          return conversations as any[];
        },
        onFetchMessages: async (conversationId: string) => {
          if (!this.api) return { messages: [], hasMore: false };
          const result = await this.api.getMessages(conversationId);
          return {
            messages: result.messages as any[],
            hasMore: result.hasMore,
          };
        },
        onSendMessage: async (conversationId: string, body: string) => {
          if (!this.api) throw new Error("API not initialized");
          return await this.api.sendMessage(conversationId, body);
        },
        onStartConversation: async (message: string) => {
          if (!this.api || !this.sessionId)
            throw new Error("API not initialized");
          const result = await this.api.startConversation({
            sessionId: this.sessionId,
            userId: this.userId || undefined,
            message,
          });
          this.emit("chat:opened");
          return result;
        },
        onMarkMessagesRead: async (conversationId: string) => {
          if (!this.api) return;
          await this.api.markMessagesRead(conversationId);
        },

        // Roadmap API
        onFetchRoadmap: async () => {
          if (!this.api) return [];
          const result = await this.api.getPublicRoadmap();
          return result.data as any[];
        },
        onVote: async (itemId: string) => {
          if (!this.api || !this.sessionId)
            throw new Error("API not initialized");
          await this.api.voteFeedback(
            itemId,
            this.sessionId,
            this.userId || undefined,
          );
        },
        onUnvote: async (itemId: string) => {
          if (!this.api || !this.sessionId)
            throw new Error("API not initialized");
          await this.api.unvoteFeedback(itemId, this.sessionId);
        },

        // File upload
        onUploadFiles: async (files: File[]) => {
          if (!this.api) throw new Error("API not initialized");
          const mediaIds: string[] = [];
          for (const file of files) {
            // For now, we need an interactionId to upload files
            // This would typically be passed from the form submission context
            // For now, return empty array - file uploads will be handled in the form submission
            console.warn(
              "[Relay] File upload requires interactionId - handle in form submission",
            );
          }
          return mediaIds;
        },
      },
    });

    this.widget.mount();
  }

  /**
   * Capture bug from the widget (with pre-captured screenshot)
   */
  private async captureBugFromWidget(
    data: BugReportData & { screenshotBlob?: Blob },
  ): Promise<string> {
    if (!this.api || !this.sessionId) {
      throw new Error("Relay not initialized");
    }

    const context = this.getTechnicalContext();

    // Create interaction
    const { interactionId } = await this.api.createInteraction({
      type: "bug",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      contentText: data.description,
      content: {
        title: data.title,
        description: data.description,
        tags: data.tags,
      },
      severity: data.severity,
      tags: data.tags,
      technicalContext: context,
    });

    // Store logs if requested
    if (data.includeLogs !== false) {
      const consoleLogs = this.consoleCapture.getEntries();
      const networkLogs = this.networkCapture.getEntries();
      const errors = this.errorCapture.getEntries();

      if (
        consoleLogs.length > 0 ||
        networkLogs.length > 0 ||
        errors.length > 0
      ) {
        await this.api.storeLogs({
          interactionId,
          console: consoleLogs,
          network: networkLogs,
          errors,
        });
      }
    }

    // Upload screenshot (use pre-captured from widget)
    if (data.screenshotBlob && data.includeScreenshot !== false) {
      await this.uploadMedia(interactionId, "screenshot", data.screenshotBlob);
    }

    // Upload attachments
    if (data.attachments) {
      for (const file of data.attachments) {
        await this.uploadMedia(interactionId, "attachment", file);
      }
    }

    this.emit("bug:submitted", { interactionId });

    return interactionId;
  }

  /**
   * Capture feature request from the widget (with file attachments)
   */
  private async captureFeatureRequestFromWidget(data: {
    title: string;
    description: string;
    category: string;
    attachments?: File[];
  }): Promise<string> {
    if (!this.api || !this.sessionId) {
      throw new Error("Relay not initialized");
    }

    const context = this.getTechnicalContext();

    // Create interaction
    const { interactionId } = await this.api.createInteraction({
      type: "feedback",
      source: "sdk",
      sessionId: this.sessionId,
      userId: this.userId || undefined,
      contentText: `[Feature Request] ${data.title}\n\n${data.description}`,
      content: {
        title: data.title,
        description: data.description,
        category: data.category,
      },
      technicalContext: context,
    });

    // Upload attachments
    if (data.attachments && data.attachments.length > 0) {
      for (const file of data.attachments) {
        await this.uploadMedia(interactionId, "attachment", file);
      }
    }

    this.emit("feedback:submitted", { interactionId });

    return interactionId;
  }

  private toggleWidget(): void {
    if (this.widget) {
      this.widget.toggle();
      this.widgetOpen = this.widget.isWidgetOpen();
    }
  }

  private openWidget(view?: WidgetView): void {
    if (this.widget) {
      this.widget.open(view);
      this.widgetOpen = true;
    }
  }

  private closeWidget(): void {
    if (this.widget) {
      this.widget.close();
      this.widgetOpen = false;
    }
  }
}

// Create singleton instance
const Relay = new RelaySDK();

// Export singleton and class
export { Relay, RelaySDK };
export default Relay;

// Auto-attach to window for script tag usage
if (typeof window !== "undefined") {
  (window as any).Relay = Relay;
}
