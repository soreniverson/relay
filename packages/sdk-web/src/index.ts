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
