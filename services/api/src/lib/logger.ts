import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    service: "relay-api",
    region: process.env.REGION || "us-west",
  },
});

export type Logger = typeof logger;

// Child logger factory
export function createLogger(
  name: string,
  meta?: Record<string, unknown>,
): Logger {
  return logger.child({ name, ...meta });
}
