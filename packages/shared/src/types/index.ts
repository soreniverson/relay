// ============================================================================
// RELAY CORE TYPES
// ============================================================================

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------

export const InteractionType = {
  BUG: "bug",
  FEEDBACK: "feedback",
  CHAT: "chat",
  SURVEY: "survey",
  REPLAY: "replay",
  SYSTEM: "system",
} as const;
export type InteractionType =
  (typeof InteractionType)[keyof typeof InteractionType];

export const InteractionSource = {
  WIDGET: "widget",
  SDK: "sdk",
  API: "api",
} as const;
export type InteractionSource =
  (typeof InteractionSource)[keyof typeof InteractionSource];

export const InteractionStatus = {
  NEW: "new",
  TRIAGING: "triaging",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;
export type InteractionStatus =
  (typeof InteractionStatus)[keyof typeof InteractionStatus];

export const Severity = {
  LOW: "low",
  MEDIUM: "med",
  HIGH: "high",
  CRITICAL: "critical",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const MediaKind = {
  SCREENSHOT: "screenshot",
  VIDEO: "video",
  ATTACHMENT: "attachment",
  REPLAY_BLOB: "replay_blob",
} as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const FeedbackItemStatus = {
  UNDER_REVIEW: "under_review",
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  SHIPPED: "shipped",
  WONT_DO: "wont_do",
} as const;
export type FeedbackItemStatus =
  (typeof FeedbackItemStatus)[keyof typeof FeedbackItemStatus];

export const RoadmapItemStatus = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  SHIPPED: "shipped",
} as const;
export type RoadmapItemStatus =
  (typeof RoadmapItemStatus)[keyof typeof RoadmapItemStatus];

export const RoadmapVisibility = {
  PUBLIC: "public",
  PRIVATE: "private",
} as const;
export type RoadmapVisibility =
  (typeof RoadmapVisibility)[keyof typeof RoadmapVisibility];

export const ConversationStatus = {
  OPEN: "open",
  CLOSED: "closed",
} as const;
export type ConversationStatus =
  (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const MessageDirection = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
} as const;
export type MessageDirection =
  (typeof MessageDirection)[keyof typeof MessageDirection];

export const IntegrationProvider = {
  LINEAR: "linear",
  JIRA: "jira",
  GITHUB: "github",
  SLACK: "slack",
  EMAIL: "email",
} as const;
export type IntegrationProvider =
  (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const Region = {
  US_WEST: "us-west",
  EU_WEST: "eu-west",
} as const;
export type Region = (typeof Region)[keyof typeof Region];

export const Environment = {
  PRODUCTION: "production",
  STAGING: "staging",
  DEVELOPMENT: "development",
} as const;
export type Environment = (typeof Environment)[keyof typeof Environment];

export const ActorType = {
  USER: "user",
  ADMIN: "admin",
  SYSTEM: "system",
  API: "api",
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const UserRole = {
  OWNER: "owner",
  ADMIN: "admin",
  AGENT: "agent",
  VIEWER: "viewer",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ----------------------------------------------------------------------------
// Core Entities
// ----------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  region: Region;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  allowedDomains?: string[];
  privacyDefaults: PrivacyDefaults;
  captureDefaults: CaptureDefaults;
  brandingConfig?: BrandingConfig;
  widgetConfig?: WidgetConfig;
}

export interface PrivacyDefaults {
  maskInputs: boolean;
  maskEmails: boolean;
  maskNumbers: boolean;
  customMaskSelectors: string[];
  blockSelectors: string[];
}

export interface CaptureDefaults {
  console: boolean;
  network: boolean;
  dom: boolean;
  replay: boolean;
}

export interface BrandingConfig {
  primaryColor?: string;
  logoUrl?: string;
  companyName?: string;
}

export interface WidgetConfig {
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  showBugReport: boolean;
  showFeedback: boolean;
  showChat: boolean;
  showSurveys: boolean;
  buttonText?: string;
}

export interface ApiKey {
  id: string;
  projectId: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for identification
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  scopes: ApiKeyScope[];
}

export type ApiKeyScope = "ingest" | "read" | "write" | "admin";

export interface EndUser {
  id: string;
  projectId: string;
  externalUserId?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  traits: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  projectId: string;
  userId?: string;
  startedAt: Date;
  lastSeenAt: Date;
  device: DeviceInfo;
  appVersion?: string;
  environment: Environment;
  ipHash?: string;
  userAgent?: string;
  pageViews: number;
  interactionCount: number;
}

export interface DeviceInfo {
  type: "desktop" | "mobile" | "tablet" | "unknown";
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  devicePixelRatio?: number;
  language?: string;
  timezone?: string;
}

// ----------------------------------------------------------------------------
// Interactions
// ----------------------------------------------------------------------------

export interface Interaction {
  id: string;
  projectId: string;
  type: InteractionType;
  source: InteractionSource;
  userId?: string;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;

  // Content
  contentText?: string;
  contentJson?: InteractionContent;

  // Status & Categorization
  status: InteractionStatus;
  severity?: Severity;
  tags: string[];
  assigneeId?: string;

  // Linked Issue
  linkedIssueProvider?: IntegrationProvider;
  linkedIssueId?: string;
  linkedIssueUrl?: string;

  // AI Processing
  aiSummary?: string;
  aiLabels: string[];
  aiDuplicateGroupId?: string;
  aiConfidence?: number;

  // Context
  privacyScope?: PrivacyScope;
  technicalContext?: TechnicalContext;

  // Relations (populated on query)
  media?: Media[];
  logs?: InteractionLogs;
  user?: EndUser;
  session?: Session;
}

export interface InteractionContent {
  title?: string;
  description?: string;
  steps?: string[];
  category?: string;
  rating?: number; // For NPS/surveys
  surveyId?: string;
  surveyResponses?: Record<string, unknown>;
  annotations?: Annotation[];
  customFields?: Record<string, unknown>;
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
  points?: Array<{ x: number; y: number }>;
}

export interface PrivacyScope {
  capturedFields: string[];
  maskedFields: string[];
  blockedElements: number;
  consentGiven?: boolean;
  retentionDays?: number;
}

export interface TechnicalContext {
  url: string;
  referrer?: string;
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
  connection?: { effectiveType: string; downlink: number; rtt: number };
  timestamp: number;
  timezone: string;
  locale: string;
}

// ----------------------------------------------------------------------------
// Media
// ----------------------------------------------------------------------------

export interface Media {
  id: string;
  projectId: string;
  interactionId: string;
  kind: MediaKind;
  url: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  meta?: MediaMeta;
}

export interface MediaMeta {
  width?: number;
  height?: number;
  duration?: number; // For video
  chunkIndex?: number; // For replay chunks
  totalChunks?: number;
  processingStatus?: "pending" | "processing" | "complete" | "failed";
}

export interface UploadRequest {
  projectId: string;
  interactionId: string;
  kind: MediaKind;
  contentType: string;
  sizeBytes: number;
  filename?: string;
}

export interface UploadResponse {
  mediaId: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: Date;
}

// ----------------------------------------------------------------------------
// Logs
// ----------------------------------------------------------------------------

export interface InteractionLogs {
  id: string;
  projectId: string;
  interactionId: string;
  console?: ConsoleEntry[];
  network?: NetworkEntry[];
  errors?: ErrorEntry[];
  createdAt: Date;
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
  initiator?: string;
}

export interface ErrorEntry {
  message: string;
  stack?: string;
  type?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
  count: number; // How many times this error occurred
}

// ----------------------------------------------------------------------------
// Replay
// ----------------------------------------------------------------------------

export interface ReplaySession {
  id: string;
  projectId: string;
  sessionId: string;
  interactionId?: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  eventCount: number;
  status: "recording" | "processing" | "ready" | "failed";
  chunks: ReplayChunk[];
}

export interface ReplayChunk {
  id: string;
  index: number;
  mediaId: string;
  eventCount: number;
  startTime: number;
  endTime: number;
  sizeBytes: number;
}

export interface ReplayEvent {
  type: number; // rrweb event type
  data: unknown;
  timestamp: number;
}

// ----------------------------------------------------------------------------
// Feedback
// ----------------------------------------------------------------------------

export interface FeedbackItem {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: FeedbackItemStatus;
  category?: string;
  voteCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Admin user ID
  linkedInteractionCount: number;
}

export interface FeedbackVote {
  id: string;
  projectId: string;
  feedbackItemId: string;
  userId?: string;
  sessionId: string;
  createdAt: Date;
}

export interface FeedbackLink {
  id: string;
  projectId: string;
  feedbackItemId: string;
  interactionId: string;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Roadmap
// ----------------------------------------------------------------------------

export interface RoadmapItem {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  visibility: RoadmapVisibility;
  status: RoadmapItemStatus;
  sortOrder: number;
  eta?: Date;
  createdAt: Date;
  updatedAt: Date;
  linkedFeedbackCount: number;
}

export interface RoadmapLink {
  id: string;
  projectId: string;
  roadmapItemId: string;
  feedbackItemId?: string;
  interactionId?: string;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Surveys
// ----------------------------------------------------------------------------

export interface Survey {
  id: string;
  projectId: string;
  name: string;
  definition: SurveyDefinition;
  targeting: SurveyTargeting;
  active: boolean;
  responseCount: number;
  createdAt: Date;
  updatedAt: Date;
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

export interface SurveyTargeting {
  showOnce: boolean;
  showAfterSeconds?: number;
  showOnPages?: string[];
  excludePages?: string[];
  userSegment?: UserSegment;
  sampleRate?: number; // 0-1
  startDate?: Date;
  endDate?: Date;
}

export interface UserSegment {
  traits?: Record<string, unknown>;
  hasCompletedSurvey?: boolean;
  minSessionCount?: number;
  minInteractionCount?: number;
}

export interface SurveyResponse {
  id: string;
  projectId: string;
  surveyId: string;
  interactionId: string;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Conversations (Chat)
// ----------------------------------------------------------------------------

export interface Conversation {
  id: string;
  projectId: string;
  userId?: string;
  sessionId: string;
  status: ConversationStatus;
  subject?: string;
  assigneeId?: string;
  lastMessageAt?: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;

  // Populated on query
  user?: EndUser;
  messages?: Message[];
}

export interface Message {
  id: string;
  projectId: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  authorId?: string; // Admin user for outbound
  createdAt: Date;
  readAt?: Date;
  meta?: MessageMeta;
}

export interface MessageMeta {
  attachmentIds?: string[];
  isAutomated?: boolean;
  triggeredBy?: string;
}

// ----------------------------------------------------------------------------
// Admin Users (Dashboard users)
// ----------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role: UserRole;
  projectMemberships: ProjectMembership[];
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface ProjectMembership {
  projectId: string;
  role: UserRole;
  joinedAt: Date;
}

// ----------------------------------------------------------------------------
// Audit Logs
// ----------------------------------------------------------------------------

export interface AuditLog {
  id: string;
  projectId: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ----------------------------------------------------------------------------
// Privacy Rules
// ----------------------------------------------------------------------------

export interface PrivacyRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  rule: PrivacyRuleDefinition;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivacyRuleDefinition {
  type: "mask" | "block" | "exclude";
  selector?: string;
  pattern?: string;
  fields?: string[];
  scope: "all" | "replay" | "screenshot" | "logs";
}

// ----------------------------------------------------------------------------
// Integrations
// ----------------------------------------------------------------------------

export interface Integration {
  id: string;
  projectId: string;
  provider: IntegrationProvider;
  enabled: boolean;
  config: IntegrationConfig;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
}

export type IntegrationConfig =
  | LinearIntegrationConfig
  | SlackIntegrationConfig
  | JiraIntegrationConfig
  | GitHubIntegrationConfig
  | EmailIntegrationConfig;

export interface LinearIntegrationConfig {
  provider: "linear";
  accessToken?: string; // Encrypted
  teamId?: string;
  defaultLabelIds?: string[];
  autoCreateIssues: boolean;
  statusMapping?: Record<string, InteractionStatus>;
}

export interface SlackIntegrationConfig {
  provider: "slack";
  webhookUrl?: string; // Encrypted
  channelId?: string;
  notifyOn: {
    newBug: boolean;
    highSeverity: boolean;
    newFeedback: boolean;
    newChat: boolean;
  };
}

export interface JiraIntegrationConfig {
  provider: "jira";
  siteUrl?: string;
  apiToken?: string; // Encrypted
  projectKey?: string;
  issueType?: string;
  // TODO: Implement full Jira integration
}

export interface GitHubIntegrationConfig {
  provider: "github";
  accessToken?: string; // Encrypted
  owner?: string;
  repo?: string;
  // TODO: Implement full GitHub integration
}

export interface EmailIntegrationConfig {
  provider: "email";
  notifyAddresses?: string[];
  replyToAddress?: string;
  // TODO: Implement full email integration
}

export interface IntegrationLink {
  id: string;
  projectId: string;
  provider: IntegrationProvider;
  externalId: string;
  internalType: "interaction" | "feedback_item" | "roadmap_item";
  internalId: string;
  externalUrl?: string;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Feature Flags
// ----------------------------------------------------------------------------

export interface FeatureFlag {
  id: string;
  projectId: string;
  flag: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------------------------
// Control Plane (Global)
// ----------------------------------------------------------------------------

export interface ProjectRegistry {
  projectId: string;
  region: Region;
  billingPlan: BillingPlan;
  ownerUserId: string;
  createdAt: Date;
}

export type BillingPlan = "free" | "indie" | "team" | "business" | "enterprise";

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface InboxFilters {
  types?: InteractionType[];
  statuses?: InteractionStatus[];
  severities?: Severity[];
  tags?: string[];
  assigneeId?: string;
  userId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  hasReplay?: boolean;
}

export interface InboxSort {
  field: "createdAt" | "updatedAt" | "severity";
  direction: "asc" | "desc";
}

// ----------------------------------------------------------------------------
// SDK Types
// ----------------------------------------------------------------------------

export interface SDKConfig {
  apiKey: string;
  endpoint?: string;
  regionHint?: Region;
  user?: SDKUser;
  session?: SDKSession;
  environment?: Environment;
  appVersion?: string;
  privacy?: PrivacyConfig;
  capture?: CaptureConfig;
}

export interface SDKUser {
  id: string;
  email?: string;
  name?: string;
  traits?: Record<string, unknown>;
}

export interface SDKSession {
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

// ----------------------------------------------------------------------------
// AI Types
// ----------------------------------------------------------------------------

export interface AISummary {
  interactionId: string;
  summary: string;
  suggestedLabels: string[];
  suggestedSeverity?: Severity;
  confidence: number;
  processedAt: Date;
}

export interface AIDuplicateGroup {
  id: string;
  projectId: string;
  signature: string;
  interactionIds: string[];
  representativeId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------------------------------
// Realtime Types
// ----------------------------------------------------------------------------

export interface RealtimeEvent {
  type:
    | "interaction.created"
    | "interaction.updated"
    | "message.created"
    | "conversation.updated";
  projectId: string;
  payload: unknown;
  timestamp: Date;
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type ID = string;
