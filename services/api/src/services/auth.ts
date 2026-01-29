import { prisma } from "../lib/prisma";
import { cache } from "../lib/redis";
import { createLogger } from "../lib/logger";
import * as jose from "jose";
import * as bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type { Project, AdminUser, ApiKey } from "@prisma/client";

const logger = createLogger("auth");

// JWT configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "relay-dev-secret-change-in-production",
);
const JWT_ISSUER = "relay";
const JWT_AUDIENCE = "relay-dashboard";
const JWT_EXPIRY = "7d";

// API Key utilities
export function generateApiKey(): string {
  const prefix = "rly";
  const random = nanoid(32);
  return `${prefix}_${random}`;
}

export function getApiKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

export async function verifyApiKeyHash(
  key: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

// Verify API key and return project
export async function verifyApiKey(key: string): Promise<{
  project: Project;
  apiKey: ApiKey;
} | null> {
  const prefix = getApiKeyPrefix(key);

  // Check cache first
  const cacheKey = `apikey:${prefix}`;
  const cached = await cache.get<{ projectId: string; keyId: string }>(
    cacheKey,
  );

  if (cached) {
    // Validate hash
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: cached.keyId },
      include: { project: true },
    });

    if (apiKey && (await verifyApiKeyHash(key, apiKey.keyHash))) {
      // Update last used
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return { project: apiKey.project, apiKey };
    }
  }

  // Query by prefix
  const apiKeys = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix },
    include: { project: true },
  });

  for (const apiKey of apiKeys) {
    if (await verifyApiKeyHash(key, apiKey.keyHash)) {
      // Check expiry
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        logger.warn({ keyId: apiKey.id }, "API key expired");
        return null;
      }

      // Cache for 5 minutes
      await cache.set(
        cacheKey,
        { projectId: apiKey.projectId, keyId: apiKey.id },
        300,
      );

      // Update last used
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return { project: apiKey.project, apiKey };
    }
  }

  logger.warn({ prefix }, "Invalid API key");
  return null;
}

// Create API key for project
export async function createApiKey(
  projectId: string,
  name: string,
  scopes: string[],
  expiresAt?: Date,
): Promise<{ key: string; apiKey: ApiKey }> {
  const key = generateApiKey();
  const keyHash = await hashApiKey(key);
  const keyPrefix = getApiKeyPrefix(key);

  const apiKey = await prisma.apiKey.create({
    data: {
      projectId,
      keyHash,
      keyPrefix,
      name,
      scopes,
      expiresAt,
    },
  });

  logger.info({ projectId, keyId: apiKey.id }, "Created API key");

  return { key, apiKey };
}

// JWT utilities
export async function createJwt(
  userId: string,
  email: string,
): Promise<string> {
  const jwt = await new jose.SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  return jwt;
}

export async function verifyJwt(token: string): Promise<{
  userId: string;
  email: string;
} | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch (error) {
    logger.warn({ error }, "Invalid JWT");
    return null;
  }
}

// Magic link utilities
const MAGIC_LINK_EXPIRY_MINUTES = 15;

export async function createMagicLink(email: string): Promise<{
  token: string;
  user: AdminUser;
  isNewUser: boolean;
}> {
  // Find or create user
  let user = await prisma.adminUser.findUnique({ where: { email } });
  let isNewUser = false;

  if (!user) {
    user = await prisma.adminUser.create({
      data: { email },
    });
    isNewUser = true;
    logger.info({ userId: user.id, email }, "Created new admin user");
  }

  // Create magic link token
  const token = nanoid(48);
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000,
  );

  await prisma.magicLink.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  logger.info({ userId: user.id }, "Created magic link");

  return { token, user, isNewUser };
}

export async function verifyMagicLink(token: string): Promise<{
  user: AdminUser;
  jwt: string;
} | null> {
  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!magicLink) {
    logger.warn("Magic link not found");
    return null;
  }

  if (magicLink.usedAt) {
    logger.warn({ token }, "Magic link already used");
    return null;
  }

  if (magicLink.expiresAt < new Date()) {
    logger.warn({ token }, "Magic link expired");
    return null;
  }

  // Mark as used
  await prisma.magicLink.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() },
  });

  // Update last login
  await prisma.adminUser.update({
    where: { id: magicLink.userId },
    data: { lastLoginAt: new Date() },
  });

  // Create JWT
  const jwt = await createJwt(magicLink.user.id, magicLink.user.email);

  logger.info({ userId: magicLink.user.id }, "Magic link verified");

  return { user: magicLink.user, jwt };
}

// Password utilities (optional, for users who prefer password auth)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
