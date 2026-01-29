// ============================================================================
// REPLAY CAPTURE
// Full DOM replay using rrweb
// ============================================================================

import type { record, eventWithTime } from "rrweb";
import type { ReplayConfig } from "../types";

interface ReplayCapture {
  start(config?: ReplayConfig): void;
  stop(): Promise<eventWithTime[]>;
  isRecording(): boolean;
  getEvents(): eventWithTime[];
  clearEvents(): void;
}

// Chunk configuration
const CHUNK_INTERVAL_MS = 5000; // Send chunk every 5 seconds
const MAX_EVENTS_PER_CHUNK = 5000;

export function createReplayCapture(
  onChunk?: (events: eventWithTime[], chunkIndex: number) => void,
): ReplayCapture {
  let stopFn: (() => void) | null | undefined = null;
  let events: eventWithTime[] = [];
  let chunkIndex = 0;
  let chunkTimer: ReturnType<typeof setInterval> | null = null;
  let lastChunkTime = 0;
  let recording = false;
  let rrwebRecord: typeof record | null = null;

  function sendChunk() {
    if (events.length === 0) return;

    const chunkEvents = [...events];
    events = [];

    if (onChunk) {
      onChunk(chunkEvents, chunkIndex);
      chunkIndex++;
    }

    lastChunkTime = Date.now();
  }

  return {
    async start(config: ReplayConfig = {}) {
      if (recording) return;

      // Dynamically import rrweb
      const rrweb = await import("rrweb");
      rrwebRecord = rrweb.record;

      recording = true;
      events = [];
      chunkIndex = 0;
      lastChunkTime = Date.now();

      // Default privacy settings
      const defaultMaskTextSelector = 'input[type="password"], .relay-mask';
      const defaultBlockSelector = ".relay-block";

      stopFn = rrwebRecord({
        emit(event) {
          events.push(event);

          // Check if we should send a chunk
          if (
            events.length >= MAX_EVENTS_PER_CHUNK ||
            Date.now() - lastChunkTime >= CHUNK_INTERVAL_MS
          ) {
            sendChunk();
          }
        },
        maskTextSelector: config.maskTextSelector || defaultMaskTextSelector,
        maskInputOptions: {
          password: true,
          email: config.maskTextSelector ? true : false,
        },
        blockSelector: config.blockSelector || defaultBlockSelector,
        blockClass: config.blockClass,
        maskTextClass: config.maskTextClass,
        maskTextFn: config.maskTextFn,
        sampling: config.sampling || {
          mousemove: 50, // Record mouse every 50ms
          mouseInteraction: true,
          scroll: 150, // Record scroll every 150ms
          media: 800,
          input: "last",
        },
        slimDOMOptions: {
          script: true,
          comment: true,
          headFavicon: true,
          headWhitespace: true,
          headMetaSocial: true,
          headMetaRobots: true,
          headMetaHttpEquiv: true,
          headMetaVerification: true,
          headMetaAuthorship: true,
        },
        recordCanvas: false, // Canvas recording is expensive
        recordCrossOriginIframes: false,
        collectFonts: true,
        inlineImages: false,
        inlineStylesheet: true,
      });

      // Set up periodic chunking
      chunkTimer = setInterval(sendChunk, CHUNK_INTERVAL_MS);
    },

    async stop() {
      if (!recording) return [];

      recording = false;

      // Clear chunk timer
      if (chunkTimer) {
        clearInterval(chunkTimer);
        chunkTimer = null;
      }

      // Stop recording
      if (stopFn) {
        stopFn();
        stopFn = null;
      }

      // Send final chunk
      sendChunk();

      return events;
    },

    isRecording() {
      return recording;
    },

    getEvents() {
      return [...events];
    },

    clearEvents() {
      events = [];
    },
  };
}

// Utility to estimate events size
export function estimateEventsSize(events: eventWithTime[]): number {
  try {
    return JSON.stringify(events).length;
  } catch {
    // Estimate based on event count
    return events.length * 500; // Rough estimate: 500 bytes per event
  }
}
