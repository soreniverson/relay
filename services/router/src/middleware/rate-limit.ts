import { MiddlewareHandler } from "hono";

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  max: 1000, // requests per window
};

// In-memory rate limit store (use Durable Objects in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(
  config: Partial<RateLimitConfig> = {},
): MiddlewareHandler {
  const { windowMs, max } = { ...defaultConfig, ...config };

  return async (c, next) => {
    // Get client identifier
    const clientId = getClientId(c.req);

    // Check rate limit
    const now = Date.now();
    const key = `ratelimit:${clientId}`;
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      // New window
      record = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    } else {
      // Existing window
      record.count++;
    }

    // Set headers
    c.res.headers.set("X-RateLimit-Limit", max.toString());
    c.res.headers.set(
      "X-RateLimit-Remaining",
      Math.max(0, max - record.count).toString(),
    );
    c.res.headers.set("X-RateLimit-Reset", record.resetAt.toString());

    if (record.count > max) {
      return c.json(
        {
          error: "rate_limit_exceeded",
          message: "Too many requests, please try again later",
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
        429,
      );
    }

    await next();

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      cleanup(now);
    }
  };
}

function getClientId(req: any): string {
  // Use API key if present
  const apiKey = req.header("X-API-Key");
  if (apiKey) {
    // Hash the key to create identifier
    return `key:${apiKey.slice(-8)}`;
  }

  // Fall back to IP
  const ip =
    req.header("CF-Connecting-IP") ||
    req.header("X-Forwarded-For")?.split(",")[0] ||
    "unknown";

  return `ip:${ip}`;
}

function cleanup(now: number) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}
