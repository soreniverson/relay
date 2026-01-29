import { z } from "zod";
import {
  router,
  projectProcedure,
  publicProcedure,
  sdkProcedure,
} from "../lib/trpc";
import { TRPCError } from "@trpc/server";

// Checklist item schema
const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  completionEvent: z.string().optional(),
  completionUrl: z.string().optional(),
  completionSelector: z.string().optional(),
  action: z
    .object({
      type: z.enum(["url", "tour", "custom"]),
      url: z.string().optional(),
      tourId: z.string().optional(),
    })
    .optional(),
  icon: z.string().optional(),
  reward: z.string().optional(),
});

// Targeting schema
const targetingSchema = z.object({
  userTraits: z.record(z.any()).optional(),
  segment: z.string().optional(),
  showToNewUsersOnly: z.boolean().optional(),
});

export const checklistsRouter = router({
  // ============================================================================
  // CHECKLIST CRUD
  // ============================================================================

  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        enabled: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const checklists = await ctx.prisma.checklist.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enabled !== undefined && { enabled: input.enabled }),
        },
        orderBy: { createdAt: "desc" },
      });

      return checklists;
    }),

  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const checklist = await ctx.prisma.checklist.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: { progress: true },
          },
        },
      });

      if (!checklist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Checklist not found",
        });
      }

      return checklist;
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        items: z.array(checklistItemSchema).min(1),
        targeting: targetingSchema.optional(),
        position: z
          .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
          .default("bottom-right"),
        style: z
          .enum(["default", "minimal", "progress-bar"])
          .default("default"),
        enabled: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const checklist = await ctx.prisma.checklist.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          items: input.items as any,
          targeting: input.targeting as any,
          position: input.position,
          style: input.style,
          enabled: input.enabled,
        },
      });

      return checklist;
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        items: z.array(checklistItemSchema).optional(),
        targeting: targetingSchema.optional(),
        position: z
          .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
          .optional(),
        style: z.enum(["default", "minimal", "progress-bar"]).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const checklist = await ctx.prisma.checklist.update({
        where: { id },
        data: {
          ...data,
          items: data.items as any,
          targeting: data.targeting as any,
        },
      });

      return checklist;
    }),

  delete: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.checklist.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggle: projectProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const checklist = await ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });

      return checklist;
    }),

  // ============================================================================
  // CHECKLIST ANALYTICS
  // ============================================================================

  getAnalytics: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const checklist = await ctx.prisma.checklist.findUnique({
        where: { id: input.id },
      });

      if (!checklist) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Checklist not found",
        });
      }

      const allProgress = await ctx.prisma.checklistProgress.findMany({
        where: { checklistId: input.id },
      });

      const items = checklist.items as any[];
      const totalUsers = allProgress.length;
      const completedUsers = allProgress.filter(
        (p) => p.completedAt !== null,
      ).length;
      const dismissedUsers = allProgress.filter((p) => p.dismissed).length;

      // Per-item completion stats
      const itemStats = items.map((item: any) => {
        const completedCount = allProgress.filter((p) =>
          p.completedItems.includes(item.id),
        ).length;

        return {
          itemId: item.id,
          title: item.title,
          completedCount,
          completionRate:
            totalUsers > 0 ? (completedCount / totalUsers) * 100 : 0,
        };
      });

      return {
        totalUsers,
        completedUsers,
        dismissedUsers,
        completionRate:
          totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
        dismissRate: totalUsers > 0 ? (dismissedUsers / totalUsers) * 100 : 0,
        itemStats,
      };
    }),

  // ============================================================================
  // SDK ENDPOINTS
  // ============================================================================

  // Get active checklists for a session
  getActiveChecklists: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        sessionId: z.string(),
        userId: z.string().optional(),
        userTraits: z.record(z.any()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get all enabled checklists
      const checklists = await ctx.prisma.checklist.findMany({
        where: {
          projectId: input.projectId,
          enabled: true,
        },
      });

      // Get progress for this session
      const progress = await ctx.prisma.checklistProgress.findMany({
        where: {
          sessionId: input.sessionId,
          checklistId: { in: checklists.map((c) => c.id) },
        },
      });

      const progressMap = new Map(progress.map((p) => [p.checklistId, p]));

      // Filter checklists based on targeting and progress
      const eligibleChecklists = checklists.filter((checklist) => {
        const checklistProgress = progressMap.get(checklist.id);

        // If already completed or dismissed, skip
        if (
          checklistProgress &&
          (checklistProgress.completedAt || checklistProgress.dismissed)
        ) {
          return false;
        }

        // Check user traits targeting
        const targeting = checklist.targeting as any;
        if (targeting?.userTraits && input.userTraits) {
          for (const [key, value] of Object.entries(targeting.userTraits)) {
            if (input.userTraits[key] !== value) {
              return false;
            }
          }
        }

        return true;
      });

      return eligibleChecklists.map((checklist) => {
        const checklistProgress = progressMap.get(checklist.id);
        return {
          id: checklist.id,
          name: checklist.name,
          description: checklist.description,
          items: checklist.items,
          position: checklist.position,
          style: checklist.style,
          completedItems: checklistProgress?.completedItems || [],
        };
      });
    }),

  // Start a checklist
  startChecklist: publicProcedure
    .input(
      z.object({
        checklistId: z.string(),
        sessionId: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const progress = await ctx.prisma.checklistProgress.upsert({
        where: {
          checklistId_sessionId: {
            checklistId: input.checklistId,
            sessionId: input.sessionId,
          },
        },
        update: {},
        create: {
          checklistId: input.checklistId,
          sessionId: input.sessionId,
          userId: input.userId,
          completedItems: [],
        },
      });

      return progress;
    }),

  // Complete a checklist item
  completeItem: publicProcedure
    .input(
      z.object({
        checklistId: z.string(),
        sessionId: z.string(),
        itemId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const progress = await ctx.prisma.checklistProgress.findUnique({
        where: {
          checklistId_sessionId: {
            checklistId: input.checklistId,
            sessionId: input.sessionId,
          },
        },
      });

      if (!progress) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Progress not found",
        });
      }

      // Add item to completed list if not already there
      const completedItems = progress.completedItems.includes(input.itemId)
        ? progress.completedItems
        : [...progress.completedItems, input.itemId];

      // Check if all items are completed
      const checklist = await ctx.prisma.checklist.findUnique({
        where: { id: input.checklistId },
      });

      const items = (checklist?.items as any[]) || [];
      const allCompleted = items.every((item: any) =>
        completedItems.includes(item.id),
      );

      const updated = await ctx.prisma.checklistProgress.update({
        where: {
          checklistId_sessionId: {
            checklistId: input.checklistId,
            sessionId: input.sessionId,
          },
        },
        data: {
          completedItems,
          completedAt: allCompleted ? new Date() : undefined,
        },
      });

      return {
        ...updated,
        allCompleted,
      };
    }),

  // Dismiss checklist
  dismiss: publicProcedure
    .input(
      z.object({
        checklistId: z.string(),
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const progress = await ctx.prisma.checklistProgress.update({
        where: {
          checklistId_sessionId: {
            checklistId: input.checklistId,
            sessionId: input.sessionId,
          },
        },
        data: { dismissed: true },
      });

      return progress;
    }),
});
