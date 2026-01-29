// ============================================================================
// NETWORK CAPTURE
// Captures fetch and XHR requests
// ============================================================================

import type { NetworkEntry } from "../types";

interface NetworkCapture {
  start(): void;
  stop(): void;
  getEntries(): NetworkEntry[];
  clear(): void;
}

// Patterns to exclude from capture (e.g., Relay's own API calls)
const EXCLUDE_PATTERNS = [/relay\.dev/i, /localhost:3001/i, /\/trpc\//i];

function shouldCapture(url: string): boolean {
  return !EXCLUDE_PATTERNS.some((pattern) => pattern.test(url));
}

export function createNetworkCapture(maxEntries = 200): NetworkCapture {
  const entries: NetworkEntry[] = [];
  let isCapturing = false;

  // Store original methods
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  function addEntry(entry: NetworkEntry) {
    if (!isCapturing) return;

    entries.push(entry);

    // Trim old entries
    while (entries.length > maxEntries) {
      entries.shift();
    }
  }

  // Fetch interceptor
  function fetchInterceptor(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const startTime = Date.now();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method || "GET";

    if (!shouldCapture(url)) {
      return originalFetch.call(window, input, init);
    }

    const entry: NetworkEntry = {
      method: method.toUpperCase(),
      url,
      timestamp: startTime,
    };

    // Estimate request size
    if (init?.body) {
      try {
        entry.requestSize =
          typeof init.body === "string"
            ? init.body.length
            : init.body instanceof Blob
              ? init.body.size
              : init.body instanceof ArrayBuffer
                ? init.body.byteLength
                : undefined;
      } catch {
        // Ignore
      }
    }

    return originalFetch.call(window, input, init).then(
      async (response) => {
        entry.status = response.status;
        entry.duration = Date.now() - startTime;

        // Try to get response size from header
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
          entry.responseSize = parseInt(contentLength, 10);
        }

        addEntry(entry);
        return response;
      },
      (error) => {
        entry.duration = Date.now() - startTime;
        entry.error = error?.message || "Network error";
        addEntry(entry);
        throw error;
      },
    );
  }

  return {
    start() {
      if (isCapturing) return;
      isCapturing = true;

      // Override fetch
      window.fetch = fetchInterceptor;

      // Override XHR
      XMLHttpRequest.prototype.open = function (
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null,
      ) {
        const urlStr = url.toString();

        (this as any).__relayData = {
          method: method.toUpperCase(),
          url: urlStr,
          startTime: 0,
          shouldCapture: shouldCapture(urlStr),
        };

        return originalXHROpen.call(
          this,
          method,
          url,
          async ?? true,
          username,
          password,
        );
      };

      XMLHttpRequest.prototype.send = function (
        body?: Document | XMLHttpRequestBodyInit | null,
      ) {
        const data = (this as any).__relayData;

        if (data?.shouldCapture) {
          data.startTime = Date.now();

          // Estimate request size
          if (body) {
            try {
              data.requestSize =
                typeof body === "string"
                  ? body.length
                  : body instanceof Blob
                    ? body.size
                    : body instanceof ArrayBuffer
                      ? body.byteLength
                      : undefined;
            } catch {
              // Ignore
            }
          }

          this.addEventListener("load", () => {
            const entry: NetworkEntry = {
              method: data.method,
              url: data.url,
              status: this.status,
              duration: Date.now() - data.startTime,
              requestSize: data.requestSize,
              timestamp: data.startTime,
            };

            // Try to get response size
            const contentLength = this.getResponseHeader("content-length");
            if (contentLength) {
              entry.responseSize = parseInt(contentLength, 10);
            }

            addEntry(entry);
          });

          this.addEventListener("error", () => {
            const entry: NetworkEntry = {
              method: data.method,
              url: data.url,
              duration: Date.now() - data.startTime,
              error: "Network error",
              timestamp: data.startTime,
            };
            addEntry(entry);
          });

          this.addEventListener("timeout", () => {
            const entry: NetworkEntry = {
              method: data.method,
              url: data.url,
              duration: Date.now() - data.startTime,
              error: "Timeout",
              timestamp: data.startTime,
            };
            addEntry(entry);
          });
        }

        return originalXHRSend.call(this, body);
      };
    },

    stop() {
      if (!isCapturing) return;
      isCapturing = false;

      // Restore original methods
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
    },

    getEntries() {
      return [...entries];
    },

    clear() {
      entries.length = 0;
    },
  };
}
