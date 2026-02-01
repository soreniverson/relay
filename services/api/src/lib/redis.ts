import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const isDev = process.env.NODE_ENV !== "production";

// In-memory fallback when Redis is not configured
const memoryCache = new Map<string, { value: string; expires?: number }>();

let redisConnected = false;
let redis: Redis | null = null;

// Only connect to Redis if REDIS_URL is explicitly set
if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (isDev && times > 2) {
        console.log("Redis not available, using in-memory fallback");
        return null; // Stop retrying in dev
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on("error", (err) => {
    if (!isDev) {
      console.error("Redis connection error:", err);
    }
    redisConnected = false;
  });

  redis.on("connect", () => {
    console.log("Redis connected");
    redisConnected = true;
  });

  // Try to connect
  redis.connect().catch(() => {
    if (isDev) {
      console.log(
        "Redis not available, using in-memory fallback for development",
      );
    }
  });
} else {
  console.log("REDIS_URL not set: Using in-memory cache (realtime features disabled)");
}

// Cache utilities with fallback
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (redis && redisConnected) {
      const value = await redis.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    }
    // Memory fallback
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expires && Date.now() > item.expires) {
      memoryCache.delete(key);
      return null;
    }
    try {
      return JSON.parse(item.value) as T;
    } catch {
      return item.value as unknown as T;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (redis && redisConnected) {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } else {
      // Memory fallback
      memoryCache.set(key, {
        value: serialized,
        expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      });
    }
  },

  async del(key: string): Promise<void> {
    if (redis && redisConnected) {
      await redis.del(key);
    } else {
      memoryCache.delete(key);
    }
  },

  async exists(key: string): Promise<boolean> {
    if (redis && redisConnected) {
      return (await redis.exists(key)) === 1;
    }
    const item = memoryCache.get(key);
    if (!item) return false;
    if (item.expires && Date.now() > item.expires) {
      memoryCache.delete(key);
      return false;
    }
    return true;
  },

  async incr(key: string): Promise<number> {
    if (redis && redisConnected) {
      return redis.incr(key);
    }
    // Memory fallback
    const item = memoryCache.get(key);
    const current = item ? parseInt(item.value, 10) || 0 : 0;
    const next = current + 1;
    memoryCache.set(key, { value: String(next), expires: item?.expires });
    return next;
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (redis && redisConnected) {
      await redis.expire(key, seconds);
    } else {
      const item = memoryCache.get(key);
      if (item) {
        item.expires = Date.now() + seconds * 1000;
      }
    }
  },
};

// Rate limiting with fallback
export const rateLimit = {
  async check(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

    const count = await cache.incr(windowKey);
    if (count === 1) {
      await cache.expire(windowKey, windowSeconds);
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt =
      Math.ceil(now / (windowSeconds * 1000)) * windowSeconds * 1000;

    return { allowed, remaining, resetAt };
  },
};

// Pub/Sub - only works with Redis, provides no-op fallback
export const pubsub = {
  publisher: redis,

  async publish(channel: string, message: unknown): Promise<void> {
    if (redis && redisConnected) {
      await redis.publish(channel, JSON.stringify(message));
    }
    // No-op in memory mode - realtime features won't work
  },

  createSubscriber(): Redis | null {
    if (!redis || !redisConnected || !redisUrl) {
      return null;
    }
    return new Redis(redisUrl);
  },
};

// Export redis instance for direct access if needed
export { redis };
