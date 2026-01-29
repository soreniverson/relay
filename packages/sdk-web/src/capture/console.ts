// ============================================================================
// CONSOLE CAPTURE
// Captures console.log, warn, error, etc.
// ============================================================================

import type { ConsoleEntry } from "../types";

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

interface ConsoleCapture {
  start(): void;
  stop(): void;
  getEntries(): ConsoleEntry[];
  clear(): void;
}

export function createConsoleCapture(maxEntries = 500): ConsoleCapture {
  const entries: ConsoleEntry[] = [];
  const originalMethods: Record<ConsoleMethod, (...args: unknown[]) => void> = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  let isCapturing = false;

  function serialize(arg: unknown): unknown {
    if (arg === null || arg === undefined) return arg;
    if (
      typeof arg === "string" ||
      typeof arg === "number" ||
      typeof arg === "boolean"
    )
      return arg;

    try {
      // Try to serialize objects
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
        };
      }

      if (arg instanceof Event) {
        return {
          type: arg.type,
          target: arg.target?.constructor?.name,
        };
      }

      // Attempt JSON serialization
      const str = JSON.stringify(arg, null, 0);
      if (str && str.length < 5000) {
        return JSON.parse(str);
      }

      return "[Object too large]";
    } catch {
      return String(arg);
    }
  }

  function createHandler(level: ConsoleMethod): (...args: unknown[]) => void {
    return (...args: unknown[]) => {
      // Call original
      originalMethods[level].apply(console, args);

      if (!isCapturing) return;

      const entry: ConsoleEntry = {
        level,
        message: args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
        args: args.slice(0, 5).map(serialize),
        timestamp: Date.now(),
      };

      // Capture stack for errors
      if (level === "error" && args[0] instanceof Error) {
        entry.stack = (args[0] as Error).stack;
      }

      entries.push(entry);

      // Trim old entries
      while (entries.length > maxEntries) {
        entries.shift();
      }
    };
  }

  return {
    start() {
      if (isCapturing) return;
      isCapturing = true;

      (Object.keys(originalMethods) as ConsoleMethod[]).forEach((method) => {
        console[method] = createHandler(method);
      });
    },

    stop() {
      if (!isCapturing) return;
      isCapturing = false;

      (Object.keys(originalMethods) as ConsoleMethod[]).forEach((method) => {
        console[method] = originalMethods[method];
      });
    },

    getEntries() {
      return [...entries];
    },

    clear() {
      entries.length = 0;
    },
  };
}
