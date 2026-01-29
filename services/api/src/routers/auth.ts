import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '../lib/trpc';
import { createMagicLink, verifyMagicLink, createApiKey, createJwt, hashPassword, verifyPassword } from '../services/auth';
import { sendMagicLinkEmail, sendWelcomeEmail } from '../services/email';
import {
  magicLinkSchema,
  verifyMagicLinkSchema,
  createProjectSchema,
  createApiKeySchema,
  registerSchema,
  loginSchema,
} from '@relay/shared';

export const authRouter = router({
  // Register with email and password
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      // Check if user already exists
      const existingUser = await ctx.prisma.adminUser.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        });
      }

      // Hash password and create user
      const passwordHash = await hashPassword(input.password);
      const user = await ctx.prisma.adminUser.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
        },
      });

      ctx.logger.info({ userId: user.id, email: user.email }, 'New user registered');

      // Create JWT
      const jwt = await createJwt(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          projects: [],
        },
        token: jwt,
      };
    }),

  // Login with email and password
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      // Find user by email
      const user = await ctx.prisma.adminUser.findUnique({
        where: { email: input.email },
      });

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Verify password
      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Update last login
      await ctx.prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Fetch user's projects
      const memberships = await ctx.prisma.projectMembership.findMany({
        where: { userId: user.id },
        select: {
          projectId: true,
          role: true,
        },
      });

      const projectIds = memberships.map((m) => m.projectId);
      const projects = await ctx.prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          name: true,
          region: true,
        },
      });

      // Create JWT
      const jwt = await createJwt(user.id, user.email);

      ctx.logger.info({ userId: user.id }, 'User logged in');

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          projects: projects.map((p) => ({
            ...p,
            role: memberships.find((m) => m.projectId === p.id)?.role,
          })),
        },
        token: jwt,
      };
    }),

  // Request magic link
  requestMagicLink: publicProcedure
    .input(magicLinkSchema)
    .mutation(async ({ input, ctx }) => {
      const { token, user, isNewUser } = await createMagicLink(input.email);

      // Send welcome email for new users (async, don't block)
      if (isNewUser) {
        sendWelcomeEmail({ to: input.email, name: user.name || undefined }).catch(() => {
          ctx.logger.warn({ email: input.email }, 'Failed to send welcome email');
        });
      }

      // In development, log the link for easy access
      if (process.env.NODE_ENV === 'development') {
        ctx.logger.info({ token }, `Magic link: ${process.env.APP_URL}/auth/verify?token=${token}`);
      }

      // Send magic link email
      const emailSent = await sendMagicLinkEmail({
        to: input.email,
        token,
      });

      if (!emailSent) {
        ctx.logger.warn({ email: input.email }, 'Failed to send magic link email');
        // Don't reveal email delivery status to client for security
      }

      return {
        success: true,
        message: 'Magic link sent to your email',
      };
    }),

  // Verify magic link
  verifyMagicLink: publicProcedure
    .input(verifyMagicLinkSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await verifyMagicLink(input.token);

      if (!result) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired magic link',
        });
      }

      // Fetch user's projects
      const memberships = await ctx.prisma.projectMembership.findMany({
        where: { userId: result.user.id },
        select: {
          projectId: true,
          role: true,
        },
      });

      const projectIds = memberships.map((m) => m.projectId);
      const projects = await ctx.prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          name: true,
          region: true,
        },
      });

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          avatarUrl: result.user.avatarUrl,
          projects: projects.map((p) => ({
            ...p,
            role: memberships.find((m) => m.projectId === p.id)?.role,
          })),
        },
        token: result.jwt,
      };
    }),

  // Get current user
  me: authedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.projectMembership.findMany({
      where: { userId: ctx.adminUser.id },
      select: {
        projectId: true,
        role: true,
        joinedAt: true,
      },
    });

    // Get projects
    const projectIds = memberships.map((m) => m.projectId);
    const projects = await ctx.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        region: true,
        createdAt: true,
      },
    });

    return {
      id: ctx.adminUser.id,
      email: ctx.adminUser.email,
      name: ctx.adminUser.name,
      avatarUrl: ctx.adminUser.avatarUrl,
      projects: projects.map((p) => ({
        ...p,
        role: memberships.find((m) => m.projectId === p.id)?.role,
      })),
    };
  }),

  // Update profile
  updateProfile: authedProcedure
    .input(
      z.object({
        name: z.string().max(100).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.adminUser.update({
        where: { id: ctx.adminUser.id },
        data: {
          name: input.name,
          avatarUrl: input.avatarUrl,
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
    }),

  // Create project
  createProject: authedProcedure
    .input(createProjectSchema)
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          region: input.region === 'us-west' ? 'us_west' : 'eu_west',
          settings: {
            privacyDefaults: {
              maskInputs: true,
              maskEmails: true,
              maskNumbers: false,
              customMaskSelectors: [],
              blockSelectors: [],
            },
            captureDefaults: {
              console: true,
              network: true,
              dom: true,
              replay: true,
            },
          },
        },
      });

      // Add creator as owner
      await ctx.prisma.projectMembership.create({
        data: {
          userId: ctx.adminUser.id,
          projectId: project.id,
          role: 'owner',
        },
      });

      // Create default API key
      const { key } = await createApiKey(project.id, 'Default', ['ingest', 'read']);

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          projectId: project.id,
          actorType: 'admin',
          actorId: ctx.adminUser.id,
          action: 'project.created',
          targetType: 'project',
          targetId: project.id,
        },
      });

      ctx.logger.info({ projectId: project.id }, 'Project created');

      return {
        project: {
          id: project.id,
          name: project.name,
          region: project.region,
          createdAt: project.createdAt,
        },
        apiKey: key,
      };
    }),

  // Create API key
  createApiKey: authedProcedure
    .input(
      createApiKeySchema.extend({
        projectId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify project access
      const membership = await ctx.prisma.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.adminUser.id,
            projectId: input.projectId,
          },
        },
      });

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only project owners and admins can create API keys',
        });
      }

      const { key, apiKey } = await createApiKey(
        input.projectId,
        input.name,
        input.scopes,
        input.expiresAt
      );

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          projectId: input.projectId,
          actorType: 'admin',
          actorId: ctx.adminUser.id,
          action: 'apikey.created',
          targetType: 'apikey',
          targetId: apiKey.id,
        },
      });

      return {
        id: apiKey.id,
        key, // Only returned on creation
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      };
    }),

  // List API keys
  listApiKeys: authedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify project access
      const membership = await ctx.prisma.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.adminUser.id,
            projectId: input.projectId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        });
      }

      const apiKeys = await ctx.prisma.apiKey.findMany({
        where: { projectId: input.projectId },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return apiKeys;
    }),

  // Revoke API key
  revokeApiKey: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        keyId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify project access
      const membership = await ctx.prisma.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.adminUser.id,
            projectId: input.projectId,
          },
        },
      });

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only project owners and admins can revoke API keys',
        });
      }

      await ctx.prisma.apiKey.delete({
        where: { id: input.keyId, projectId: input.projectId },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          projectId: input.projectId,
          actorType: 'admin',
          actorId: ctx.adminUser.id,
          action: 'apikey.revoked',
          targetType: 'apikey',
          targetId: input.keyId,
        },
      });

      return { success: true };
    }),
});
