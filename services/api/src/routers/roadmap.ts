import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure, sdkProcedure } from "../lib/trpc";
import {
  createRoadmapItemSchema,
  updateRoadmapItemSchema,
  paginationSchema,
  roadmapItemStatusSchema,
  roadmapVisibilitySchema,
} from "@relay/shared";

export const roadmapRouter = router({
  // List roadmap items (dashboard)
  list: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid() })
        .merge(paginationSchema)
        .extend({
          status: roadmapItemStatusSchema.optional(),
          visibility: roadmapVisibilitySchema.optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize, status, visibility } = input;

      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };

      if (status) {
        where.status = status;
      }
      if (visibility) {
        where.visibility = visibility;
      }

      const [items, total] = await Promise.all([
        ctx.prisma.roadmapItem.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            _count: {
              select: {
                roadmapLinks: true,
              },
            },
          },
        }),
        ctx.prisma.roadmapItem.count({ where }),
      ]);

      return {
        data: items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          visibility: item.visibility,
          status: item.status,
          sortOrder: item.sortOrder,
          eta: item.eta,
          linkedFeedbackCount: item._count.roadmapLinks,
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

  // Get single roadmap item
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        roadmapItemId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const item = await ctx.prisma.roadmapItem.findUnique({
        where: { id: input.roadmapItemId, projectId: ctx.projectId },
        include: {
          roadmapLinks: {
            include: {
              feedbackItem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  voteCount: true,
                },
              },
              interaction: {
                select: {
                  id: true,
                  type: true,
                  contentText: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Roadmap item not found",
        });
      }

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        visibility: item.visibility,
        status: item.status,
        sortOrder: item.sortOrder,
        eta: item.eta,
        linkedFeedback: item.roadmapLinks
          .filter((link) => link.feedbackItem)
          .map((link) => link.feedbackItem!),
        linkedInteractions: item.roadmapLinks
          .filter((link) => link.interaction)
          .map((link) => link.interaction!),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    }),

  // Create roadmap item
  create: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid() }).merge(createRoadmapItemSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const item = await ctx.prisma.roadmapItem.create({
        data: {
          projectId: ctx.projectId,
          title: input.title,
          description: input.description,
          visibility: input.visibility,
          status: input.status,
          eta: input.eta,
          sortOrder: input.sortOrder || 0,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "roadmap_item.created",
          targetType: "roadmap_item",
          targetId: item.id,
        },
      });

      return item;
    }),

  // Update roadmap item
  update: projectProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid(),
          roadmapItemId: z.string().uuid(),
        })
        .merge(updateRoadmapItemSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const item = await ctx.prisma.roadmapItem.update({
        where: { id: input.roadmapItemId, projectId: ctx.projectId },
        data: {
          title: input.title,
          description: input.description,
          visibility: input.visibility,
          status: input.status,
          eta: input.eta,
          sortOrder: input.sortOrder,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "roadmap_item.updated",
          targetType: "roadmap_item",
          targetId: item.id,
          meta: input,
        },
      });

      return item;
    }),

  // Delete roadmap item
  delete: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        roadmapItemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.roadmapItem.delete({
        where: { id: input.roadmapItemId, projectId: ctx.projectId },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "roadmap_item.deleted",
          targetType: "roadmap_item",
          targetId: input.roadmapItemId,
        },
      });

      return { success: true };
    }),

  // Link feedback to roadmap item
  linkFeedback: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        roadmapItemId: z.string().uuid(),
        feedbackItemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.roadmapLink.create({
        data: {
          projectId: ctx.projectId,
          roadmapItemId: input.roadmapItemId,
          feedbackItemId: input.feedbackItemId,
        },
      });

      // Update linked count
      await ctx.prisma.roadmapItem.update({
        where: { id: input.roadmapItemId },
        data: { linkedFeedbackCount: { increment: 1 } },
      });

      return { success: true };
    }),

  // Unlink feedback from roadmap item
  unlinkFeedback: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        roadmapItemId: z.string().uuid(),
        feedbackItemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const link = await ctx.prisma.roadmapLink.findFirst({
        where: {
          projectId: ctx.projectId,
          roadmapItemId: input.roadmapItemId,
          feedbackItemId: input.feedbackItemId,
        },
      });

      if (link) {
        await ctx.prisma.roadmapLink.delete({
          where: { id: link.id },
        });

        await ctx.prisma.roadmapItem.update({
          where: { id: input.roadmapItemId },
          data: { linkedFeedbackCount: { decrement: 1 } },
        });
      }

      return { success: true };
    }),

  // Reorder roadmap items
  reorder: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        items: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.$transaction(
        input.items.map((item) =>
          ctx.prisma.roadmapItem.update({
            where: { id: item.id, projectId: ctx.projectId },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      return { success: true };
    }),

  // Public roadmap (SDK)
  publicList: sdkProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize } = input;

      const items = await ctx.prisma.roadmapItem.findMany({
        where: {
          projectId: ctx.projectId,
          visibility: "public",
        },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          eta: true,
          createdAt: true,
        },
      });

      return {
        data: items,
        page,
        pageSize,
      };
    }),
});
