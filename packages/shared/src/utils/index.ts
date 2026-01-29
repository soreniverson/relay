import { Region, Severity, InteractionStatus } from '../types';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a prefixed ID for different entity types
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export const idPrefixes = {
  project: 'prj',
  apiKey: 'key',
  user: 'usr',
  session: 'ses',
  interaction: 'int',
  media: 'med',
  replay: 'rpl',
  feedback: 'fdb',
  roadmap: 'rdm',
  survey: 'srv',
  conversation: 'cnv',
  message: 'msg',
  integration: 'itg',
  auditLog: 'aud',
} as const;

// ============================================================================
// API Key Utilities
// ============================================================================

/**
 * Generate a new API key (returns the raw key, not hashed)
 */
export function generateApiKey(): string {
  const prefix = 'rly';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${key}`;
}

/**
 * Get the prefix of an API key for identification
 */
export function getApiKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return /^rly_[A-Za-z0-9]{32}$/.test(key);
}

// ============================================================================
// Region Utilities
// ============================================================================

export const regionEndpoints: Record<Region, string> = {
  'us-west': 'https://us-west.api.relay.dev',
  'eu-west': 'https://eu-west.api.relay.dev',
};

export const regionDisplayNames: Record<Region, string> = {
  'us-west': 'US West (Oregon)',
  'eu-west': 'EU West (Ireland)',
};

/**
 * Get the API endpoint for a region
 */
export function getRegionEndpoint(region: Region): string {
  return regionEndpoints[region];
}

// ============================================================================
// Severity Utilities
// ============================================================================

export const severityOrder: Record<Severity, number> = {
  low: 1,
  med: 2,
  high: 3,
  critical: 4,
};

export const severityColors: Record<Severity, string> = {
  low: '#22c55e', // green
  med: '#eab308', // yellow
  high: '#f97316', // orange
  critical: '#ef4444', // red
};

/**
 * Compare two severities
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return severityOrder[a] - severityOrder[b];
}

/**
 * Check if severity A is higher than severity B
 */
export function isHigherSeverity(a: Severity, b: Severity): boolean {
  return severityOrder[a] > severityOrder[b];
}

// ============================================================================
// Status Utilities
// ============================================================================

export const statusOrder: Record<InteractionStatus, number> = {
  new: 1,
  triaging: 2,
  in_progress: 3,
  resolved: 4,
  closed: 5,
};

export const statusColors: Record<InteractionStatus, string> = {
  new: '#3b82f6', // blue
  triaging: '#8b5cf6', // purple
  in_progress: '#f59e0b', // amber
  resolved: '#22c55e', // green
  closed: '#6b7280', // gray
};

export const statusLabels: Record<InteractionStatus, string> = {
  new: 'New',
  triaging: 'Triaging',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

// ============================================================================
// Error Signature Utilities
// ============================================================================

/**
 * Generate a signature hash for error deduplication
 */
export function generateErrorSignature(error: {
  message: string;
  stack?: string;
  filename?: string;
}): string {
  // Normalize the error message (remove dynamic parts like IDs, timestamps)
  const normalizedMessage = error.message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b\d{10,13}\b/g, '<TIMESTAMP>')
    .replace(/\b\d+\b/g, '<NUM>');

  // Get the first few lines of the stack trace
  const stackLines = error.stack?.split('\n').slice(0, 5).join('\n') || '';

  const content = `${normalizedMessage}|${error.filename || ''}|${stackLines}`;
  return simpleHash(content);
}

/**
 * Simple string hash function
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Normalize a URL for comparison
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query params and hash
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}

// ============================================================================
// Privacy Utilities
// ============================================================================

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
const creditCardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const ssnRegex = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;

/**
 * Mask sensitive data in text
 */
export function maskSensitiveData(
  text: string,
  options: {
    maskEmails?: boolean;
    maskPhones?: boolean;
    maskCreditCards?: boolean;
    maskSSN?: boolean;
  } = {}
): string {
  let result = text;

  if (options.maskEmails !== false) {
    result = result.replace(emailRegex, '[EMAIL]');
  }
  if (options.maskPhones !== false) {
    result = result.replace(phoneRegex, '[PHONE]');
  }
  if (options.maskCreditCards !== false) {
    result = result.replace(creditCardRegex, '[CARD]');
  }
  if (options.maskSSN !== false) {
    result = result.replace(ssnRegex, '[SSN]');
  }

  return result;
}

/**
 * Hash IP address for privacy
 */
export function hashIpAddress(ip: string, salt: string): string {
  return simpleHash(`${ip}:${salt}`);
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

// ============================================================================
// Size Utilities
// ============================================================================

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================================================
// Retry Utilities
// ============================================================================

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const defaultRetryOptions: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(attempt: number, options: RetryOptions = defaultRetryOptions): number {
  const delay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, options.maxDelayMs);
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_REPLAY_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024; // 10MB
export const REPLAY_CHUNK_INTERVAL_MS = 5000; // 5 seconds
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/webm', 'video/mp4'];
export const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  'application/pdf',
  'text/plain',
  'application/json',
];

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Mask an email address (e.g., "u***@e***.com")
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const [domainName, ...tld] = domain.split('.');
  return `${local[0]}***@${domainName[0]}***.${tld.join('.')}`;
}

/**
 * Mask a phone number (e.g., "***-***-4567")
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const lastFour = digits.slice(-4);
  const digitsToMask = digits.length - 4;
  let masked = phone;
  let count = 0;
  masked = masked.replace(/\d/g, (match) => {
    if (count < digitsToMask) {
      count++;
      return '*';
    }
    return match;
  });
  return masked;
}
