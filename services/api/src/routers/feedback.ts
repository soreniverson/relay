import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  projectProcedure,
  sdkProcedure,
  publicProcedure,
} from "../lib/trpc";
import {
  createFeedbackItemSchema,
  updateFeedbackItemSchema,
  paginationSchema,
  feedbackItemStatusSchema,
} from "@relay/shared";

export const feedbackRouter = router({
  // List feedback items (dashboard)
  list: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid() })
        .merge(paginationSchema)
        .extend({
          status: feedbackItemStatusSchema.optional(),
          category: z.string().optional(),
          sortBy: z.enum(["votes", "createdAt", "updatedAt"]).default("votes"),
          sortDir: z.enum(["asc", "desc"]).default("desc"),
        }),
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize, status, category, sortBy, sortDir } = input;

      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };

      if (status) {
        where.status = status;
      }
      if (category) {
        where.category = category;
      }

      const orderBy =
        sortBy === "votes" ? { voteCount: sortDir } : { [sortBy]: sortDir };

      const [items, total] = await Promise.all([
        ctx.prisma.feedbackItem.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            _count: {
              select: {
                votes: true,
                feedbackLinks: true,
              },
            },
          },
        }),
        ctx.prisma.feedbackItem.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          status: item.status,
          category: item.category,
          voteCount: item.voteCount,
          linkedInteractionCount: item._count.feedbackLinks,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
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

  // Get single feedback item
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        feedbackItemId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const item = await ctx.prisma.feedbackItem.findUnique({
        where: { id: input.feedbackItemId, projectId: ctx.projectId },
        include: {
          feedbackLinks: {
            include: {
              interaction: {
                select: {
                  id: true,
                  type: true,
                  contentText: true,
                  createdAt: true,
                  user: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          roadmapLinks: {
            include: {
              roadmapItem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback item not found",
        });
      }

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        category: item.category,
        voteCount: item._count.votes,
        linkedInteractions: item.feedbackLinks.map((link) => link.interaction),
        linkedRoadmapItems: item.roadmapLinks.map((link) => link.roadmapItem),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }),

  // Create feedback item (dashboard)
  create: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid() })
        .merge(createFeedbackItemSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const item = await ctx.prisma.feedbackItem.create({
        data: {
          projectId: ctx.projectId,
          title: input.title,
          description: input.description,
          category: input.category,
          status: input.status || "under_review",
          createdBy: ctx.adminUser!.id,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "feedback_item.created",
          targetType: "feedback_item",
          targetId: item.id,
        },
      });

      return item;
    }),

  // Update feedback item
  update: projectProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid(),
          feedbackItemId: z.string().uuid(),
        })
        .merge(updateFeedbackItemSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const item = await ctx.prisma.feedbackItem.update({
        where: { id: input.feedbackItemId, projectId: ctx.projectId },
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          status: input.status,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "feedback_item.updated",
          targetType: "feedback_item",
          targetId: item.id,
          meta: input,
        },
      });

      return item;
    }),

  // Delete feedback item
  delete: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        feedbackItemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.feedbackItem.delete({
        where: { id: input.feedbackItemId, projectId: ctx.projectId },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "feedback_item.deleted",
          targetType: "feedback_item",
          targetId: input.feedbackItemId,
        },
      });

      return { success: true };
    }),

  // Link interaction to feedback item
  linkInteraction: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        feedbackItemId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Verify both exist
      const [item, interaction] = await Promise.all([
        ctx.prisma.feedbackItem.findUnique({
          where: { id: input.feedbackItemId, projectId: ctx.projectId },
        }),
        ctx.prisma.interaction.findUnique({
          where: { id: input.interactionId, projectId: ctx.projectId },
        }),
      ]);

      if (!item || !interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback item or interaction not found",
        });
      }

      await ctx.prisma.feedbackLink.create({
        data: {
          projectId: ctx.projectId,
          feedbackItemId: input.feedbackItemId,
          interactionId: input.interactionId,
        },
      });

      // Update linked count
      await ctx.prisma.feedbackItem.update({
        where: { id: input.feedbackItemId },
        data: { linkedInteractionCount: { increment: 1 } },
      });

      return { success: true };
    }),

  // Unlink interaction from feedback item
  unlinkInteraction: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        feedbackItemId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.feedbackLink.delete({
        where: {
          feedbackItemId_interactionId: {
            feedbackItemId: input.feedbackItemId,
            interactionId: input.interactionId,
          },
        },
      });

      // Update linked count
      await ctx.prisma.feedbackItem.update({
        where: { id: input.feedbackItemId },
        data: { linkedInteractionCount: { decrement: 1 } },
      });

      return { success: true };
    }),

  // Vote on feedback item (SDK)
  vote: sdkProcedure
    .input(
      z.object({
        feedbackItemId: z.string().uuid(),
        sessionId: z.string().uuid(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check if already voted
      const existingVote = await ctx.prisma.feedbackVote.findUnique({
        where: {
          feedbackItemId_sessionId: {
            feedbackItemId: input.feedbackItemId,
            sessionId: input.sessionId,
          },
        },
      });

      if (existingVote) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already voted on this item",
        });
      }

      // Resolve user ID
      let userId: string | null = null;
      if (input.userId) {
        const user = await ctx.prisma.endUser.findUnique({
          where: {
            projectId_externalUserId: {
              projectId: ctx.projectId,
              externalUserId: input.userId,
            },
          },
        });
        userId = user?.id || null;
      }

      await ctx.prisma.feedbackVote.create({
        data: {
          projectId: ctx.projectId,
          feedbackItemId: input.feedbackItemId,
          sessionId: input.sessionId,
          userId,
        },
      });

      // Update vote count
      await ctx.prisma.feedbackItem.update({
        where: { id: input.feedbackItemId },
        data: { voteCount: { increment: 1 } },
      });

      return { success: true };
    }),

  // Unvote on feedback item (SDK)
  unvote: sdkProcedure
    .input(
      z.object({
        feedbackItemId: z.string().uuid(),
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingVote = await ctx.prisma.feedbackVote.findUnique({
        where: {
          feedbackItemId_sessionId: {
            feedbackItemId: input.feedbackItemId,
            sessionId: input.sessionId,
          },
        },
      });

      if (!existingVote) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No vote to remove",
        });
      }

      await ctx.prisma.feedbackVote.delete({
        where: { id: existingVote.id },
      });

      // Update vote count
      await ctx.prisma.feedbackItem.update({
        where: { id: input.feedbackItemId },
        data: { voteCount: { decrement: 1 } },
      });

      return { success: true };
    }),

  // Get public feedback board (SDK)
  publicList: sdkProcedure
    .input(
      z.object({
        sessionId: z.string().uuid().optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize, sessionId } = input;

      // Only return items with certain statuses
      const items = await ctx.prisma.feedbackItem.findMany({
        where: {
          projectId: ctx.projectId,
          status: { in: ["under_review", "planned", "in_progress", "shipped"] },
        },
        orderBy: { voteCount: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          category: true,
          voteCount: true,
          createdAt: true,
        },
      });

      // Check which items the session has voted on
      let votedItemIds: string[] = [];
      if (sessionId) {
        const votes = await ctx.prisma.feedbackVote.findMany({
          where: {
            projectId: ctx.projectId,
            sessionId,
            feedbackItemId: { in: items.map((i) => i.id) },
          },
          select: { feedbackItemId: true },
        });
        votedItemIds = votes.map((v) => v.feedbackItemId);
      }

      return {
        data: items.map((item) => ({
          ...item,
          hasVoted: votedItemIds.includes(item.id),
        })),
        page,
        pageSize,
      };
    }),

  // Get categories
  categories: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const items = await ctx.prisma.feedbackItem.findMany({
        where: { projectId: ctx.projectId, category: { not: null } },
        select: { category: true },
        distinct: ["category"],
      });

      return items.map((i) => i.category).filter(Boolean) as string[];
    }),

  // Public submit feedback (for public feedback boards)
  publicSubmit: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        title: z.string().min(1).max(500),
        description: z.string().max(10000).optional(),
        category: z.string().max(100).optional(),
        email: z.string().email().optional(),
        sessionId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Find project by slug
      const project = await ctx.prisma.project.findUnique({
        where: { slug: input.slug },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Create feedback item
      const item = await ctx.prisma.feedbackItem.create({
        data: {
          projectId: project.id,
          title: input.title,
          description: input.description,
          category: input.category,
          status: "under_review",
        },
      });

      // If email provided, create or find user
      if (input.email) {
        let user = await ctx.prisma.endUser.findFirst({
          where: {
            projectId: project.id,
            email: input.email,
          },
        });

        if (!user) {
          user = await ctx.prisma.endUser.create({
            data: {
              projectId: project.id,
              email: input.email,
            },
          });
        }
      }

      return {
        id: item.id,
        title: item.title,
        status: item.status,
      };
    }),

  // Public vote (for public feedback boards by slug)
  publicVote: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        feedbackItemId: z.string().uuid(),
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Find project by slug
      const project = await ctx.prisma.project.findUnique({
        where: { slug: input.slug },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check if already voted
      const existingVote = await ctx.prisma.feedbackVote.findUnique({
        where: {
          feedbackItemId_sessionId: {
            feedbackItemId: input.feedbackItemId,
            sessionId: input.sessionId,
          },
        },
      });

      if (existingVote) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already voted on this item",
        });
      }

      await ctx.prisma.feedbackVote.create({
        data: {
          projectId: project.id,
          feedbackItemId: input.feedbackItemId,
          sessionId: input.sessionId,
        },
      });

      await ctx.prisma.feedbackItem.update({
        where: { id: input.feedbackItemId },
        data: { voteCount: { increment: 1 } },
      });

      return { success: true };
    }),

  // Public list by slug (for public feedback boards)
  publicListBySlug: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        sessionId: z.string().uuid().optional(),
        status: feedbackItemStatusSchema.optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { slug, page, pageSize, sessionId, status } = input;

      // Find project by slug
      const project = await ctx.prisma.project.findUnique({
        where: { slug },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const where: Record<string, unknown> = {
        projectId: project.id,
        status: status || {
          in: ["under_review", "planned", "in_progress", "shipped"],
        },
      };

      const [items, total] = await Promise.all([
        ctx.prisma.feedbackItem.findMany({
          where,
          orderBy: { voteCount: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            category: true,
            voteCount: true,
            createdAt: true,
          },
        }),
        ctx.prisma.feedbackItem.count({ where }),
      ]);

      // Check which items the session has voted on
      let votedItemIds: string[] = [];
      if (sessionId) {
        const votes = await ctx.prisma.feedbackVote.findMany({
          where: {
            projectId: project.id,
            sessionId,
            feedbackItemId: { in: items.map((i) => i.id) },
          },
          select: { feedbackItemId: true },
        });
        votedItemIds = votes.map((v) => v.feedbackItemId);
      }

      return {
        project: {
          name: project.name,
        },
        data: items.map((item) => ({
          ...item,
          hasVoted: votedItemIds.includes(item.id),
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }),
});
