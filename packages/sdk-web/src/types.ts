// ============================================================================
// RELAY WEB SDK TYPES
// ============================================================================

export interface RelayConfig {
  apiKey: string;
  endpoint?: string;
  regionHint?: "us-west" | "eu-west";
  user?: RelayUser;
  session?: RelaySession;
  environment?: "production" | "staging" | "development";
  appVersion?: string;
  privacy?: PrivacyConfig;
  capture?: CaptureConfig;
  widget?: WidgetConfig;
  debug?: boolean;
}

export interface RelayUser {
  id: string;
  email?: string;
  name?: string;
  traits?: Record<string, unknown>;
}

export interface RelaySession {
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface PrivacyConfig {
  maskSelectors?: string[];
  blockSelectors?: string[];
  maskAllInputs?: boolean;
  maskAllText?: boolean;
}

export interface CaptureConfig {
  console?: boolean;
  network?: boolean;
  dom?: boolean;
  replay?: boolean;
}

export interface WidgetConfig {
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  primaryColor?: string;
  showBugReport?: boolean;
  showFeedback?: boolean;
  showChat?: boolean;
  showRoadmap?: boolean;
  buttonText?: string;
  autoShow?: boolean;
  /** Use mock data instead of real API calls (for testing) */
  useMockData?: boolean;
}

export interface BugReportData {
  title?: string;
  description: string;
  severity?: "low" | "med" | "high" | "critical";
  tags?: string[];
  attachments?: File[];
  includeScreenshot?: boolean;
  includeLogs?: boolean;
  includeReplay?: boolean;
}

export interface FeedbackData {
  text: string;
  category?: string;
  rating?: number;
  tags?: string[];
}

export interface Annotation {
  id: string;
  type: "arrow" | "rectangle" | "circle" | "text" | "highlight" | "blur";
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  text?: string;
}

export interface TechnicalContext {
  url: string;
  referrer: string;
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
  connection?: { effectiveType: string; downlink: number; rtt: number };
  timestamp: number;
  timezone: string;
  locale: string;
}

export interface ConsoleEntry {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  args?: unknown[];
  timestamp: number;
  stack?: string;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status?: number;
  duration?: number;
  requestSize?: number;
  responseSize?: number;
  timestamp: number;
  error?: string;
}

export interface ErrorEntry {
  message: string;
  stack?: string;
  type?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  count: number;
}

export interface ReplayConfig {
  maskTextSelector?: string;
  maskInputSelector?: string;
  blockClass?: string;
  blockSelector?: string;
  maskTextClass?: string;
  maskTextFn?: (text: string) => string;
  sampling?: {
    mousemove?: boolean | number;
    mouseInteraction?: boolean | Record<string, boolean>;
    scroll?: number;
    media?: number;
    input?: "last" | "all";
  };
}

export interface Survey {
  id: string;
  name: string;
  definition: SurveyDefinition;
}

export interface SurveyDefinition {
  type: "nps" | "csat" | "ces" | "custom";
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  thankYouMessage?: string;
}

export interface SurveyQuestion {
  id: string;
  type: "nps" | "rating" | "text" | "single_choice" | "multi_choice";
  required: boolean;
  text: string;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface FeedbackItem {
  id: string;
  title: string;
  description?: string;
  status: "under_review" | "planned" | "in_progress" | "shipped" | "wont_do";
  category?: string;
  voteCount: number;
  hasVoted: boolean;
}

export type RelayEventType =
  | "ready"
  | "open"
  | "close"
  | "bug:submitted"
  | "feedback:submitted"
  | "chat:opened"
  | "chat:closed"
  | "survey:shown"
  | "survey:completed"
  | "replay:started"
  | "replay:stopped"
  | "tour:started"
  | "tour:completed"
  | "tour:dismissed"
  | "error";

export type RelayEventHandler = (data?: unknown) => void;

export interface RelayInstance {
  init(config: RelayConfig): Promise<void>;
  identify(user: RelayUser): Promise<void>;
  setSessionAttributes(attrs: Record<string, unknown>): void;
  open(tab?: "bug" | "feedback" | "chat" | "help"): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  prefill(data: {
    title?: string;
    description?: string;
    email?: string;
    category?: string;
    tags?: string[];
  }): void;
  clearPrefill(): void;
  setCustomData(key: string, value: unknown): void;
  getCustomData(): Record<string, unknown>;
  clearCustomData(key: string): void;
  clearAllCustomData(): void;
  captureBug(data: BugReportData): Promise<string>;
  captureFeedback(data: FeedbackData): Promise<string>;
  startRecording(): void;
  stopRecording(): Promise<void>;
  setPrivacy(config: PrivacyConfig): void;
  track(event: string, properties?: Record<string, unknown>): void;
  showSurvey(surveyId: string): Promise<void>;
  checkForSurveys(triggerEvent?: string): Promise<void>;
  on(event: RelayEventType, handler: RelayEventHandler): void;
  off(event: RelayEventType, handler: RelayEventHandler): void;
  getSessionId(): string | null;
  getUserId(): string | null;
  isInitialized(): boolean;
  destroy(): void;
}
