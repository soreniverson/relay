import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type inferAsyncReturnType } from "@trpc/server";
import { type CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { prisma } from "./prisma";
import { cache, rateLimit } from "./redis";
import { logger } from "./logger";
import { verifyApiKey, verifyJwt } from "../services/auth";
import type { Project, AdminUser } from "@prisma/client";

// Context type
export type Context = inferAsyncReturnType<typeof createContext>;

// Create context for each request
export async function createContext({ req, res }: CreateExpressContextOptions) {
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID();
  const log = logger.child({ requestId });

  // Extract authorization
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"] as string;

  let project: Project | null = null;
  let adminUser: AdminUser | null = null;
  let projectId: string | null = null;

  // API Key auth (for SDK)
  if (apiKey) {
    const keyData = await verifyApiKey(apiKey);
    if (keyData) {
      project = keyData.project;
      projectId = project.id;
    }
  }

  // JWT auth (for dashboard)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userData = await verifyJwt(token);
    if (userData) {
      adminUser = await prisma.adminUser.findUnique({
        where: { id: userData.userId },
      });
    }
  }

  return {
    req,
    res,
    prisma,
    cache,
    rateLimit,
    logger: log,
    requestId,
    project,
    projectId,
    adminUser,
    region: process.env.REGION || "us-west",
  };
}

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

// Export reusable components
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

// Auth middleware for SDK (requires valid API key)
const requireApiKey = middleware(async ({ ctx, next }) => {
  if (!ctx.project || !ctx.projectId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key",
    });
  }

  return next({
    ctx: {
      ...ctx,
      project: ctx.project,
      projectId: ctx.projectId,
    },
  });
});

// Auth middleware for dashboard (requires valid JWT)
const requireAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.adminUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      adminUser: ctx.adminUser,
    },
  });
});

// Project access middleware (for dashboard, checks membership)
const requireProjectAccess = middleware(async ({ ctx, next, rawInput }) => {
  if (!ctx.adminUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // Get projectId from input
  const input = rawInput as { projectId?: string } | undefined;
  const projectId = input?.projectId;

  if (!projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project ID required",
    });
  }

  // Check membership
  const membership = await ctx.prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: ctx.adminUser.id,
        projectId,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this project",
    });
  }

  const project = await ctx.prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  return next({
    ctx: {
      ...ctx,
      project,
      projectId,
      membership,
    },
  });
});

// Rate limiting middleware
const withRateLimit = (limit: number, windowSeconds: number) =>
  middleware(async ({ ctx, next }) => {
    const key = ctx.projectId || ctx.adminUser?.id || ctx.req.ip || "anonymous";
    const result = await ctx.rateLimit.check(key, limit, windowSeconds);

    if (!result.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetAt - Date.now()) / 1000)} seconds`,
      });
    }

    return next();
  });

// Procedure types
export const sdkProcedure = publicProcedure.use(requireApiKey);
export const authedProcedure = publicProcedure.use(requireAuth);
export const projectProcedure = publicProcedure.use(requireProjectAccess);

// With rate limiting
export const sdkProcedureWithRateLimit = (
  limit: number,
  windowSeconds: number,
) => sdkProcedure.use(withRateLimit(limit, windowSeconds));
export const authedProcedureWithRateLimit = (
  limit: number,
  windowSeconds: number,
) => authedProcedure.use(withRateLimit(limit, windowSeconds));
