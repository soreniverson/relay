import { z } from 'zod';
import {
  InteractionType,
  InteractionSource,
  InteractionStatus,
  Severity,
  MediaKind,
  FeedbackItemStatus,
  RoadmapItemStatus,
  RoadmapVisibility,
  ConversationStatus,
  MessageDirection,
  IntegrationProvider,
  Region,
  Environment,
  UserRole,
} from '../types';

// ============================================================================
// Base Validators
// ============================================================================

export const idSchema = z.string().uuid();
export const dateSchema = z.coerce.date();
export const emailSchema = z.string().email();

// ============================================================================
// Enum Validators
// ============================================================================

export const interactionTypeSchema = z.enum([
  InteractionType.BUG,
  InteractionType.FEEDBACK,
  InteractionType.CHAT,
  InteractionType.SURVEY,
  InteractionType.REPLAY,
  InteractionType.SYSTEM,
]);

export const interactionSourceSchema = z.enum([
  InteractionSource.WIDGET,
  InteractionSource.SDK,
  InteractionSource.API,
]);

export const interactionStatusSchema = z.enum([
  InteractionStatus.NEW,
  InteractionStatus.TRIAGING,
  InteractionStatus.IN_PROGRESS,
  InteractionStatus.RESOLVED,
  InteractionStatus.CLOSED,
]);

export const severitySchema = z.enum([
  Severity.LOW,
  Severity.MEDIUM,
  Severity.HIGH,
  Severity.CRITICAL,
]);

export const mediaKindSchema = z.enum([
  MediaKind.SCREENSHOT,
  MediaKind.VIDEO,
  MediaKind.ATTACHMENT,
  MediaKind.REPLAY_BLOB,
]);

export const feedbackItemStatusSchema = z.enum([
  FeedbackItemStatus.UNDER_REVIEW,
  FeedbackItemStatus.PLANNED,
  FeedbackItemStatus.IN_PROGRESS,
  FeedbackItemStatus.SHIPPED,
  FeedbackItemStatus.WONT_DO,
]);

export const roadmapItemStatusSchema = z.enum([
  RoadmapItemStatus.PLANNED,
  RoadmapItemStatus.IN_PROGRESS,
  RoadmapItemStatus.SHIPPED,
]);

export const roadmapVisibilitySchema = z.enum([
  RoadmapVisibility.PUBLIC,
  RoadmapVisibility.PRIVATE,
]);

export const conversationStatusSchema = z.enum([
  ConversationStatus.OPEN,
  ConversationStatus.CLOSED,
]);

export const messageDirectionSchema = z.enum([
  MessageDirection.INBOUND,
  MessageDirection.OUTBOUND,
]);

export const integrationProviderSchema = z.enum([
  IntegrationProvider.LINEAR,
  IntegrationProvider.JIRA,
  IntegrationProvider.GITHUB,
  IntegrationProvider.SLACK,
  IntegrationProvider.EMAIL,
]);

export const regionSchema = z.enum([Region.US_WEST, Region.EU_WEST]);

export const environmentSchema = z.enum([
  Environment.PRODUCTION,
  Environment.STAGING,
  Environment.DEVELOPMENT,
]);

export const userRoleSchema = z.enum([
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AGENT,
  UserRole.VIEWER,
]);

// ============================================================================
// SDK Input Validators
// ============================================================================

export const sdkUserSchema = z.object({
  id: z.string().min(1).max(255),
  email: emailSchema.optional(),
  name: z.string().max(255).optional(),
  traits: z.record(z.unknown()).optional(),
});

export const sdkSessionSchema = z.object({
  id: z.string().uuid().optional(),
  attributes: z.record(z.unknown()).optional(),
});

export const privacyConfigSchema = z.object({
  maskSelectors: z.array(z.string()).optional(),
  blockSelectors: z.array(z.string()).optional(),
  maskAllInputs: z.boolean().optional(),
  maskAllText: z.boolean().optional(),
});

export const captureConfigSchema = z.object({
  console: z.boolean().optional(),
  network: z.boolean().optional(),
  dom: z.boolean().optional(),
  replay: z.boolean().optional(),
});

export const sdkConfigSchema = z.object({
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  regionHint: regionSchema.optional(),
  user: sdkUserSchema.optional(),
  session: sdkSessionSchema.optional(),
  environment: environmentSchema.optional(),
  appVersion: z.string().max(100).optional(),
  privacy: privacyConfigSchema.optional(),
  capture: captureConfigSchema.optional(),
});

// ============================================================================
// API Input Validators - Ingest
// ============================================================================

export const deviceInfoSchema = z.object({
  type: z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
  os: z.string().max(50).optional(),
  osVersion: z.string().max(50).optional(),
  browser: z.string().max(50).optional(),
  browserVersion: z.string().max(50).optional(),
  screenWidth: z.number().int().positive().optional(),
  screenHeight: z.number().int().positive().optional(),
  devicePixelRatio: z.number().positive().optional(),
  language: z.string().max(20).optional(),
  timezone: z.string().max(100).optional(),
});

export const technicalContextSchema = z.object({
  url: z.string().url().max(2000),
  referrer: z.string().url().max(2000).optional().or(z.literal('')),
  userAgent: z.string().max(500),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  devicePixelRatio: z.number().positive(),
  memory: z
    .object({
      usedJSHeapSize: z.number(),
      totalJSHeapSize: z.number(),
    })
    .optional(),
  connection: z
    .object({
      effectiveType: z.string(),
      downlink: z.number(),
      rtt: z.number(),
    })
    .optional(),
  timestamp: z.number(),
  timezone: z.string().max(100),
  locale: z.string().max(20),
});

export const annotationSchema = z.object({
  id: z.string(),
  type: z.enum(['arrow', 'rectangle', 'circle', 'text', 'highlight', 'blur']),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().optional(),
  text: z.string().optional(),
  points: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
      })
    )
    .optional(),
});

export const interactionContentSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
  steps: z.array(z.string().max(1000)).max(50).optional(),
  category: z.string().max(100).optional(),
  rating: z.number().int().min(0).max(10).optional(),
  surveyId: idSchema.optional(),
  surveyResponses: z.record(z.unknown()).optional(),
  annotations: z.array(annotationSchema).max(100).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const createInteractionSchema = z.object({
  id: idSchema.optional(), // Client can provide for idempotency
  type: interactionTypeSchema,
  source: interactionSourceSchema,
  userId: z.string().max(255).optional(),
  sessionId: idSchema,
  contentText: z.string().max(50000).optional(),
  content: interactionContentSchema.optional(),
  severity: severitySchema.optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  technicalContext: technicalContextSchema.optional(),
});

export const createSessionSchema = z.object({
  id: idSchema.optional(),
  userId: z.string().max(255).optional(),
  device: deviceInfoSchema,
  appVersion: z.string().max(100).optional(),
  environment: environmentSchema,
  userAgent: z.string().max(500).optional(),
});

export const updateSessionSchema = z.object({
  sessionId: idSchema,
  lastSeenAt: dateSchema.optional(),
  pageViews: z.number().int().optional(),
});

// ============================================================================
// API Input Validators - Logs
// ============================================================================

export const consoleEntrySchema = z.object({
  level: z.enum(['log', 'info', 'warn', 'error', 'debug']),
  message: z.string().max(10000),
  args: z.array(z.unknown()).max(10).optional(),
  timestamp: z.number(),
  stack: z.string().max(10000).optional(),
});

export const networkEntrySchema = z.object({
  method: z.string().max(20),
  url: z.string().max(2000),
  status: z.number().int().optional(),
  duration: z.number().optional(),
  requestSize: z.number().int().optional(),
  responseSize: z.number().int().optional(),
  timestamp: z.number(),
  error: z.string().max(500).optional(),
  initiator: z.string().max(200).optional(),
});

export const errorEntrySchema = z.object({
  message: z.string().max(10000),
  stack: z.string().max(20000).optional(),
  type: z.string().max(100).optional(),
  filename: z.string().max(500).optional(),
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  timestamp: z.number(),
  count: z.number().int().default(1),
});

export const createLogsSchema = z.object({
  interactionId: idSchema,
  console: z.array(consoleEntrySchema).max(1000).optional(),
  network: z.array(networkEntrySchema).max(500).optional(),
  errors: z.array(errorEntrySchema).max(100).optional(),
});

// ============================================================================
// API Input Validators - Replay
// ============================================================================

export const startReplaySchema = z.object({
  sessionId: idSchema,
  interactionId: idSchema.optional(),
});

export const replayChunkSchema = z.object({
  replayId: idSchema,
  chunkIndex: z.number().int().min(0),
  events: z.array(z.unknown()).max(10000),
  startTime: z.number(),
  endTime: z.number(),
});

export const endReplaySchema = z.object({
  replayId: idSchema,
  totalEventCount: z.number().int(),
});

// ============================================================================
// API Input Validators - Media
// ============================================================================

export const initiateUploadSchema = z.object({
  interactionId: idSchema,
  kind: mediaKindSchema,
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
  filename: z.string().max(255).optional(),
});

export const completeUploadSchema = z.object({
  mediaId: idSchema,
});

// ============================================================================
// API Input Validators - Feedback
// ============================================================================

export const createFeedbackItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  category: z.string().max(100).optional(),
  status: feedbackItemStatusSchema.optional(),
});

export const updateFeedbackItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  category: z.string().max(100).optional(),
  status: feedbackItemStatusSchema.optional(),
});

export const voteFeedbackSchema = z.object({
  feedbackItemId: idSchema,
  sessionId: idSchema,
  userId: z.string().max(255).optional(),
});

export const linkInteractionToFeedbackSchema = z.object({
  feedbackItemId: idSchema,
  interactionId: idSchema,
});

// ============================================================================
// API Input Validators - Roadmap
// ============================================================================

export const createRoadmapItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  visibility: roadmapVisibilitySchema,
  status: roadmapItemStatusSchema,
  eta: dateSchema.optional(),
  sortOrder: z.number().int().optional(),
});

export const updateRoadmapItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  visibility: roadmapVisibilitySchema.optional(),
  status: roadmapItemStatusSchema.optional(),
  eta: dateSchema.optional(),
  sortOrder: z.number().int().optional(),
});

// ============================================================================
// API Input Validators - Surveys
// ============================================================================

export const surveyQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['nps', 'rating', 'text', 'single_choice', 'multi_choice']),
  required: z.boolean(),
  text: z.string().max(500),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string().max(200)).max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLabel: z.string().max(50).optional(),
  maxLabel: z.string().max(50).optional(),
});

export const surveyDefinitionSchema = z.object({
  type: z.enum(['nps', 'csat', 'ces', 'custom']),
  title: z.string().max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(surveyQuestionSchema).min(1).max(20),
  thankYouMessage: z.string().max(500).optional(),
});

export const userSegmentSchema = z.object({
  traits: z.record(z.unknown()).optional(),
  hasCompletedSurvey: z.boolean().optional(),
  minSessionCount: z.number().int().optional(),
  minInteractionCount: z.number().int().optional(),
});

export const surveyTargetingSchema = z.object({
  showOnce: z.boolean(),
  showAfterSeconds: z.number().int().positive().optional(),
  showOnPages: z.array(z.string().max(500)).max(50).optional(),
  excludePages: z.array(z.string().max(500)).max(50).optional(),
  userSegment: userSegmentSchema.optional(),
  sampleRate: z.number().min(0).max(1).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

export const createSurveySchema = z.object({
  name: z.string().min(1).max(200),
  definition: surveyDefinitionSchema,
  targeting: surveyTargetingSchema,
  active: z.boolean().optional(),
});

export const updateSurveySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  definition: surveyDefinitionSchema.optional(),
  targeting: surveyTargetingSchema.optional(),
  active: z.boolean().optional(),
});

export const surveyResponseSchema = z.object({
  surveyId: idSchema,
  responses: z.record(z.unknown()),
});

// ============================================================================
// API Input Validators - Conversations
// ============================================================================

export const createConversationSchema = z.object({
  userId: z.string().max(255).optional(),
  sessionId: idSchema,
  subject: z.string().max(500).optional(),
});

export const createMessageSchema = z.object({
  conversationId: idSchema,
  body: z.string().min(1).max(10000),
  direction: messageDirectionSchema,
});

// ============================================================================
// API Input Validators - Integrations
// ============================================================================

export const linearConfigSchema = z.object({
  accessToken: z.string().optional(),
  teamId: z.string().optional(),
  defaultLabelIds: z.array(z.string()).optional(),
  autoCreateIssues: z.boolean().default(false),
  statusMapping: z.record(interactionStatusSchema).optional(),
});

export const slackConfigSchema = z.object({
  webhookUrl: z.string().url().optional(),
  channelId: z.string().optional(),
  notifyOn: z.object({
    newBug: z.boolean(),
    highSeverity: z.boolean(),
    newFeedback: z.boolean(),
    newChat: z.boolean(),
  }),
});

export const connectLinearSchema = z.object({
  code: z.string(), // OAuth code
  redirectUri: z.string().url(),
});

export const connectSlackSchema = z.object({
  webhookUrl: z.string().url(),
  channelId: z.string().optional(),
});

export const syncLinearIssueSchema = z.object({
  interactionId: idSchema,
  title: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
});

// ============================================================================
// API Input Validators - Privacy
// ============================================================================

export const privacyRuleDefinitionSchema = z.object({
  type: z.enum(['mask', 'block', 'exclude']),
  selector: z.string().max(500).optional(),
  pattern: z.string().max(500).optional(),
  fields: z.array(z.string().max(100)).max(50).optional(),
  scope: z.enum(['all', 'replay', 'screenshot', 'logs']),
});

export const createPrivacyRuleSchema = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean(),
  rule: privacyRuleDefinitionSchema,
});

export const updatePrivacyRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  rule: privacyRuleDefinitionSchema.optional(),
});

// ============================================================================
// API Input Validators - Project & Auth
// ============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  region: regionSchema,
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z
    .object({
      allowedDomains: z.array(z.string().max(200)).max(50).optional(),
      privacyDefaults: z
        .object({
          maskInputs: z.boolean().optional(),
          maskEmails: z.boolean().optional(),
          maskNumbers: z.boolean().optional(),
          customMaskSelectors: z.array(z.string()).optional(),
          blockSelectors: z.array(z.string()).optional(),
        })
        .optional(),
      captureDefaults: captureConfigSchema.optional(),
      brandingConfig: z
        .object({
          primaryColor: z.string().max(20).optional(),
          logoUrl: z.string().url().max(500).optional(),
          companyName: z.string().max(200).optional(),
        })
        .optional(),
      widgetConfig: z
        .object({
          position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
          showBugReport: z.boolean().optional(),
          showFeedback: z.boolean().optional(),
          showChat: z.boolean().optional(),
          showSurveys: z.boolean().optional(),
          buttonText: z.string().max(50).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(z.enum(['ingest', 'read', 'write', 'admin'])).min(1),
  expiresAt: dateSchema.optional(),
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});

// Password must be at least 8 characters
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// ============================================================================
// Query Validators
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const inboxFiltersSchema = z.object({
  types: z.array(interactionTypeSchema).optional(),
  statuses: z.array(interactionStatusSchema).optional(),
  severities: z.array(severitySchema).optional(),
  tags: z.array(z.string()).optional(),
  assigneeId: idSchema.optional(),
  userId: z.string().optional(),
  sessionId: idSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  search: z.string().max(500).optional(),
  hasReplay: z.boolean().optional(),
});

export const inboxSortSchema = z.object({
  field: z.enum(['createdAt', 'updatedAt', 'severity']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const inboxQuerySchema = paginationSchema.merge(inboxFiltersSchema).merge(inboxSortSchema);

// ============================================================================
// Type Exports
// ============================================================================

export type SDKConfigInput = z.infer<typeof sdkConfigSchema>;
export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateLogsInput = z.infer<typeof createLogsSchema>;
export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;
export type CreateFeedbackItemInput = z.infer<typeof createFeedbackItemSchema>;
export type CreateRoadmapItemInput = z.infer<typeof createRoadmapItemSchema>;
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type InboxQueryInput = z.infer<typeof inboxQuerySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
