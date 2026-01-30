import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure, sdkProcedure } from "../lib/trpc";
import { pubsub } from "../lib/redis";
import { openai } from "../lib/openai";
import {
  paginationSchema,
  conversationStatusSchema,
  messageDirectionSchema,
} from "@relay/shared";

export const conversationsRouter = router({
  // List conversations (dashboard)
  list: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid() })
        .merge(paginationSchema)
        .extend({
          status: conversationStatusSchema.optional(),
          assigneeId: z.string().uuid().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize, status, assigneeId } = input;

      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };

      if (status) {
        where.status = status;
      }
      if (assigneeId) {
        where.assigneeId = assigneeId;
      }

      const [conversations, total] = await Promise.all([
        ctx.prisma.conversation.findMany({
          where,
          orderBy: { lastMessageAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                direction: true,
                body: true,
                createdAt: true,
              },
            },
          },
        }),
        ctx.prisma.conversation.count({ where }),
      ]);

      return {
        data: conversations.map((c) => ({
          id: c.id,
          status: c.status,
          subject: c.subject,
          assigneeId: c.assigneeId,
          lastMessageAt: c.lastMessageAt,
          messageCount: c.messageCount,
          createdAt: c.createdAt,
          user: c.user,
          lastMessage: c.messages[0] || null,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasMore: page * pageSize < total,
        },
      };
    }),

  // Get single conversation with messages
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        conversationId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId, projectId: ctx.projectId },
        include: {
          user: true,
          session: {
            select: {
              id: true,
              device: true,
              appVersion: true,
              environment: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return conversation;
    }),

  // Send message (dashboard reply)
  sendMessage: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        conversationId: z.string().uuid(),
        body: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId, projectId: ctx.projectId },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      const message = await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId: input.conversationId,
          direction: "outbound",
          body: input.body,
          authorId: ctx.adminUser!.id,
        },
      });

      // Update conversation
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });

      // Publish realtime event
      await pubsub.publish(`project:${ctx.projectId}`, {
        type: "message.created",
        projectId: ctx.projectId,
        payload: {
          conversationId: input.conversationId,
          message: {
            id: message.id,
            direction: message.direction,
            body: message.body,
            createdAt: message.createdAt,
          },
        },
      });

      // Also publish to conversation channel for widget
      await pubsub.publish(`conversation:${input.conversationId}`, {
        type: "message.created",
        payload: {
          id: message.id,
          direction: message.direction,
          body: message.body,
          createdAt: message.createdAt,
        },
      });

      return message;
    }),

  // Update conversation status
  updateStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        conversationId: z.string().uuid(),
        status: conversationStatusSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId, projectId: ctx.projectId },
        data: { status: input.status },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "conversation.status_changed",
          targetType: "conversation",
          targetId: input.conversationId,
          meta: { newStatus: input.status },
        },
      });

      // Publish realtime event
      await pubsub.publish(`project:${ctx.projectId}`, {
        type: "conversation.updated",
        projectId: ctx.projectId,
        payload: {
          id: input.conversationId,
          status: input.status,
        },
      });

      return { success: true };
    }),

  // Assign conversation
  assign: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        conversationId: z.string().uuid(),
        assigneeId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId, projectId: ctx.projectId },
        data: { assigneeId: input.assigneeId },
      });

      return { success: true };
    }),

  // Start conversation (SDK)
  start: sdkProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().optional(),
        subject: z.string().max(500).optional(),
        message: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Resolve user ID
      let internalUserId: string | null = null;
      if (input.userId) {
        const user = await ctx.prisma.endUser.findUnique({
          where: {
            projectId_externalUserId: {
              projectId: ctx.projectId,
              externalUserId: input.userId,
            },
          },
        });
        internalUserId = user?.id || null;
      }

      // Check for existing open conversation
      const existing = await ctx.prisma.conversation.findFirst({
        where: {
          projectId: ctx.projectId,
          sessionId: input.sessionId,
          status: "open",
        },
      });

      let conversationId: string;

      if (existing) {
        conversationId = existing.id;
      } else {
        // Create new conversation
        const conversation = await ctx.prisma.conversation.create({
          data: {
            projectId: ctx.projectId,
            sessionId: input.sessionId,
            userId: internalUserId,
            subject: input.subject,
            lastMessageAt: new Date(),
            messageCount: 1,
          },
        });
        conversationId = conversation.id;
      }

      // Create message
      const message = await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId,
          direction: "inbound",
          body: input.message,
        },
      });

      // Update conversation if using existing
      if (existing) {
        await ctx.prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
            messageCount: { increment: 1 },
          },
        });
      }

      // Publish realtime event
      await pubsub.publish(`project:${ctx.projectId}`, {
        type: "message.created",
        projectId: ctx.projectId,
        payload: {
          conversationId,
          message: {
            id: message.id,
            direction: message.direction,
            body: message.body,
            createdAt: message.createdAt,
          },
        },
      });

      ctx.logger.info({ conversationId }, "Conversation started");

      return { conversationId, messageId: message.id };
    }),

  // Send message (SDK)
  sendUserMessage: sdkProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        body: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId, projectId: ctx.projectId },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      if (conversation.status === "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Conversation is closed",
        });
      }

      const message = await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId: input.conversationId,
          direction: "inbound",
          body: input.body,
        },
      });

      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });

      // Publish realtime events
      await pubsub.publish(`project:${ctx.projectId}`, {
        type: "message.created",
        projectId: ctx.projectId,
        payload: {
          conversationId: input.conversationId,
          message: {
            id: message.id,
            direction: message.direction,
            body: message.body,
            createdAt: message.createdAt,
          },
        },
      });

      return { messageId: message.id };
    }),

  // Get user's conversations (SDK)
  getUserConversations: sdkProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conversations = await ctx.prisma.conversation.findMany({
        where: {
          projectId: ctx.projectId,
          sessionId: input.sessionId,
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      return conversations.map((c) => ({
        id: c.id,
        status: c.status,
        subject: c.subject,
        lastMessageAt: c.lastMessageAt,
        lastMessage: c.messages[0] || null,
      }));
    }),

  // Get conversation messages (SDK)
  getMessages: sdkProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        cursor: z.string().uuid().optional(),
        limit: z.number().int().positive().max(50).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId, projectId: ctx.projectId },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      const messages = await ctx.prisma.message.findMany({
        where: {
          conversationId: input.conversationId,
          ...(input.cursor
            ? { createdAt: { lt: new Date(input.cursor) } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return {
        messages: messages.reverse(),
        hasMore: messages.length === input.limit,
      };
    }),

  // Mark messages as read (SDK)
  markRead: sdkProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.message.updateMany({
        where: {
          conversationId: input.conversationId,
          direction: "outbound",
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return { success: true };
    }),

  // ============================================================================
  // AI COPILOT FEATURES
  // ============================================================================

  // Get AI status
  aiStatus: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(() => ({
      available: openai.isConfigured,
      features: {
        suggestReplies: openai.isConfigured,
        articleSuggestions: true,
      },
    })),

  // Get suggested replies for a conversation
  suggestReplies: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        conversationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!openai.isConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "OpenAI is not configured. Add OPENAI_API_KEY to enable AI features.",
        });
      }

      // Get conversation with messages
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId, projectId: ctx.projectId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 20, // Last 20 messages for context
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Get project name
      const project = await ctx.prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { name: true },
      });

      // Get relevant articles for context
      const lastUserMessage = [...conversation.messages]
        .reverse()
        .find((m) => m.direction === "inbound");

      let relevantArticles: Array<{ title: string; excerpt: string }> = [];
      if (lastUserMessage) {
        const articles = await ctx.prisma.article.findMany({
          where: {
            projectId: ctx.projectId,
            status: "published",
            OR: [
              {
                title: {
                  contains: lastUserMessage.body.slice(0, 50),
                  mode: "insensitive",
                },
              },
              {
                content: {
                  contains: lastUserMessage.body.slice(0, 50),
                  mode: "insensitive",
                },
              },
            ],
          },
          select: { title: true, excerpt: true },
          take: 3,
        });
        relevantArticles = articles.map((a) => ({
          title: a.title,
          excerpt: a.excerpt || a.title,
        }));
      }

      // Format conversation history
      const conversationHistory = conversation.messages.map((m) => ({
        role:
          m.direction === "inbound" ? ("user" as const) : ("agent" as const),
        content: m.body,
      }));

      // Generate suggestions
      const result = await openai.suggestReplies({
        projectName: project?.name || "this product",
        conversationHistory,
        relevantArticles,
      });

      ctx.logger.info(
        {
          conversationId: input.conversationId,
          suggestionsCount: result.suggestions.length,
        },
        "Generated reply suggestions",
      );

      return result;
    }),

  // Get relevant articles for a conversation
  getRelevantArticles: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        conversationId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Get conversation with last few messages
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId, projectId: ctx.projectId },
        include: {
          messages: {
            where: { direction: "inbound" },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Extract keywords from user messages
      const userMessages = conversation.messages.map((m) => m.body).join(" ");

      // Simple keyword extraction: take significant words
      const keywords = userMessages
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .slice(0, 10);

      if (keywords.length === 0) {
        return { articles: [] };
      }

      // Search articles matching any keyword
      const articles = await ctx.prisma.article.findMany({
        where: {
          projectId: ctx.projectId,
          status: "published",
          OR: keywords.map((keyword) => ({
            OR: [
              { title: { contains: keyword, mode: "insensitive" as const } },
              { content: { contains: keyword, mode: "insensitive" as const } },
            ],
          })),
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
        },
        take: 5,
      });

      return { articles };
    }),
});
