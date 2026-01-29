// ============================================================================
// ERROR CAPTURE
// Captures unhandled errors and promise rejections
// ============================================================================

import type { ErrorEntry } from '../types';

interface ErrorCapture {
  start(): void;
  stop(): void;
  getEntries(): ErrorEntry[];
  clear(): void;
}

export function createErrorCapture(maxEntries = 100): ErrorCapture {
  const entries: ErrorEntry[] = [];
  const errorCounts = new Map<string, number>();
  let isCapturing = false;

  function getErrorKey(error: { message: string; filename?: string; lineno?: number }): string {
    return `${error.message}|${error.filename || ''}|${error.lineno || 0}`;
  }

  function addError(error: {
    message: string;
    stack?: string;
    type?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
  }): void {
    if (!isCapturing) return;

    const key = getErrorKey(error);
    const existingCount = errorCounts.get(key) || 0;
    errorCounts.set(key, existingCount + 1);

    // Find existing entry
    const existingIndex = entries.findIndex(
      (e) => e.message === error.message && e.filename === error.filename && e.lineno === error.lineno
    );

    if (existingIndex >= 0) {
      // Update count
      entries[existingIndex].count = existingCount + 1;
    } else {
      // Add new entry
      entries.push({
        message: error.message,
        stack: error.stack,
        type: error.type,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        timestamp: Date.now(),
        count: 1,
      });

      // Trim old entries
      while (entries.length > maxEntries) {
        const removed = entries.shift()!;
        errorCounts.delete(getErrorKey(removed));
      }
    }
  }

  function handleError(event: ErrorEvent): void {
    addError({
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      type: event.error?.name || 'Error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }

  function handleRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    addError({
      message: reason?.message || String(reason) || 'Unhandled Promise Rejection',
      stack: reason?.stack,
      type: 'UnhandledRejection',
    });
  }

  return {
    start() {
      if (isCapturing) return;
      isCapturing = true;

      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleRejection);
    },

    stop() {
      if (!isCapturing) return;
      isCapturing = false;

      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    },

    getEntries() {
      return [...entries];
    },

    clear() {
      entries.length = 0;
      errorCounts.clear();
    },
  };
}
