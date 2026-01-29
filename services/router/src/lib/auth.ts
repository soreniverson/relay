import { HonoRequest } from "hono";

interface ApiKeyData {
  keyId: string;
  projectId: string;
  region: string;
  scopes: string[];
}

/**
 * Extract API key from request
 */
export function extractApiKey(req: HonoRequest): string | null {
  // Check header first
  const headerKey = req.header("X-API-Key");
  if (headerKey) return headerKey;

  // Check Authorization header
  const authHeader = req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check query parameter (for certain endpoints like media upload)
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("apiKey");
  if (queryKey) return queryKey;

  return null;
}

/**
 * Validate API key and return project/region info
 * Uses KV cache with fallback to origin validation
 */
export async function validateApiKey(
  apiKey: string,
  cache: KVNamespace,
): Promise<ApiKeyData | null> {
  // API keys have format: rly_<env>_<random>
  if (!apiKey.startsWith("rly_")) {
    return null;
  }

  // Check cache first
  const cacheKey = `apikey:${hashKey(apiKey)}`;
  const cached = await cache.get(cacheKey, "json");

  if (cached) {
    return cached as ApiKeyData;
  }

  // Not in cache - need to validate with origin
  // This is a simplified version - in production, you'd call a central registry
  // or have the key encode the region

  // Parse key format: rly_<env>_<projectId>_<random>
  const parts = apiKey.split("_");
  if (parts.length < 4) {
    return null;
  }

  // For demo purposes, derive region from key
  // In production, this would be a database lookup
  const region = deriveRegionFromKey(apiKey);

  const keyData: ApiKeyData = {
    keyId: parts.slice(3).join("_"),
    projectId: parts[2],
    region,
    scopes: ["ingest"], // Default scope
  };

  // Cache for 5 minutes
  await cache.put(cacheKey, JSON.stringify(keyData), { expirationTtl: 300 });

  return keyData;
}

/**
 * Resolve region to API URL
 */
export function resolveRegion(
  region: string,
  env: { US_WEST_API: string; EU_WEST_API: string },
): string | null {
  const regionMap: Record<string, string> = {
    "us-west": env.US_WEST_API,
    "us-east": env.US_WEST_API, // Alias to us-west for now
    "eu-west": env.EU_WEST_API,
    "eu-central": env.EU_WEST_API, // Alias to eu-west for now
  };

  return regionMap[region] || null;
}

/**
 * Hash API key for cache key (don't store raw key)
 */
function hashKey(apiKey: string): string {
  // Simple hash for demo - use proper crypto in production
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Derive region from API key
 * In production, this would be a lookup against a central registry
 */
function deriveRegionFromKey(apiKey: string): string {
  // Check for region hint in key
  if (apiKey.includes("_eu_")) {
    return "eu-west";
  }
  if (apiKey.includes("_us_")) {
    return "us-west";
  }

  // Default to us-west
  return "us-west";
}
