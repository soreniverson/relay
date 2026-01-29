import { z } from "zod";
import {
  router,
  projectProcedure,
  publicProcedure,
  sdkProcedure,
} from "../lib/trpc";
import { TRPCError } from "@trpc/server";

// Tour step schema
const tourStepSchema = z.object({
  id: z.string(),
  type: z.enum(["tooltip", "modal", "highlight", "beacon"]),
  target: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
  image: z.string().optional(),
  video: z.string().optional(),
  position: z.enum(["top", "bottom", "left", "right", "auto"]).optional(),
  primaryButton: z
    .object({
      label: z.string(),
      action: z.enum(["next", "complete", "url"]),
      url: z.string().optional(),
    })
    .optional(),
  secondaryButton: z
    .object({
      label: z.string(),
      action: z.enum(["skip", "back", "dismiss"]),
    })
    .optional(),
  advanceOn: z.enum(["click", "input", "custom"]).optional(),
  advanceSelector: z.string().optional(),
});

// Targeting schema
const targetingSchema = z.object({
  url: z.string().optional(),
  urlPattern: z.string().optional(),
  userTraits: z.record(z.any()).optional(),
  event: z.string().optional(),
  segment: z.string().optional(),
});

export const toursRouter = router({
  // ============================================================================
  // TOUR CRUD
  // ============================================================================

  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        enabled: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tours = await ctx.prisma.tour.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enabled !== undefined && { enabled: input.enabled }),
        },
        orderBy: { createdAt: "desc" },
      });

      return tours;
    }),

  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.prisma.tour.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: { progress: true },
          },
        },
      });

      if (!tour) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      }

      return tour;
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        steps: z.array(tourStepSchema).min(1),
        targeting: targetingSchema.optional(),
        showOnce: z.boolean().default(true),
        dismissible: z.boolean().default(true),
        enabled: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.prisma.tour.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          steps: input.steps as any,
          targeting: input.targeting as any,
          showOnce: input.showOnce,
          dismissible: input.dismissible,
          enabled: input.enabled,
        },
      });

      return tour;
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        steps: z.array(tourStepSchema).optional(),
        targeting: targetingSchema.optional(),
        showOnce: z.boolean().optional(),
        dismissible: z.boolean().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const tour = await ctx.prisma.tour.update({
        where: { id },
        data: {
          ...data,
          steps: data.steps as any,
          targeting: data.targeting as any,
        },
      });

      return tour;
    }),

  delete: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.tour.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggle: projectProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.prisma.tour.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });

      return tour;
    }),

  // ============================================================================
  // TOUR ANALYTICS
  // ============================================================================

  getAnalytics: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.prisma.tour.findUnique({
        where: { id: input.id },
      });

      if (!tour) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      }

      const [totalStarted, completed, dismissed] = await Promise.all([
        ctx.prisma.tourProgress.count({ where: { tourId: input.id } }),
        ctx.prisma.tourProgress.count({
          where: { tourId: input.id, completed: true },
        }),
        ctx.prisma.tourProgress.count({
          where: { tourId: input.id, dismissed: true },
        }),
      ]);

      // Get step-by-step funnel
      const steps = tour.steps as any[];
      const stepStats = await Promise.all(
        steps.map(async (step: any, index: number) => {
          const reachedCount = await ctx.prisma.tourProgress.count({
            where: {
              tourId: input.id,
              currentStep: { gte: index },
            },
          });

          return {
            stepId: step.id,
            stepIndex: index,
            title: step.title || `Step ${index + 1}`,
            reached: reachedCount,
            dropOffRate:
              totalStarted > 0
                ? ((totalStarted - reachedCount) / totalStarted) * 100
                : 0,
          };
        }),
      );

      return {
        totalStarted,
        completed,
        dismissed,
        completionRate: totalStarted > 0 ? (completed / totalStarted) * 100 : 0,
        dismissRate: totalStarted > 0 ? (dismissed / totalStarted) * 100 : 0,
        stepStats,
      };
    }),

  // ============================================================================
  // SDK ENDPOINTS
  // ============================================================================

  // Get active tours for a session
  getActiveTours: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        sessionId: z.string(),
        url: z.string().optional(),
        userTraits: z.record(z.any()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get all enabled tours
      const tours = await ctx.prisma.tour.findMany({
        where: {
          projectId: input.projectId,
          enabled: true,
        },
      });

      // Get progress for this session
      const progress = await ctx.prisma.tourProgress.findMany({
        where: {
          sessionId: input.sessionId,
          tourId: { in: tours.map((t) => t.id) },
        },
      });

      const progressMap = new Map(progress.map((p) => [p.tourId, p]));

      // Filter tours based on targeting and progress
      const eligibleTours = tours.filter((tour) => {
        const tourProgress = progressMap.get(tour.id);

        // If showOnce and already completed/dismissed, skip
        if (
          tour.showOnce &&
          tourProgress &&
          (tourProgress.completed || tourProgress.dismissed)
        ) {
          return false;
        }

        // Check URL targeting
        const targeting = tour.targeting as any;
        if (targeting?.url && input.url && !input.url.includes(targeting.url)) {
          return false;
        }

        if (targeting?.urlPattern && input.url) {
          const regex = new RegExp(targeting.urlPattern);
          if (!regex.test(input.url)) {
            return false;
          }
        }

        // Check user traits targeting
        if (targeting?.userTraits && input.userTraits) {
          for (const [key, value] of Object.entries(targeting.userTraits)) {
            if (input.userTraits[key] !== value) {
              return false;
            }
          }
        }

        return true;
      });

      return eligibleTours.map((tour) => ({
        id: tour.id,
        name: tour.name,
        steps: tour.steps,
        dismissible: tour.dismissible,
        currentStep: progressMap.get(tour.id)?.currentStep || 0,
      }));
    }),

  // Start a tour
  startTour: publicProcedure
    .input(
      z.object({
        tourId: z.string(),
        sessionId: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create or update progress
      const progress = await ctx.prisma.tourProgress.upsert({
        where: {
          tourId_sessionId: {
            tourId: input.tourId,
            sessionId: input.sessionId,
          },
        },
        update: {
          currentStep: 0,
          completed: false,
          dismissed: false,
          startedAt: new Date(),
        },
        create: {
          tourId: input.tourId,
          sessionId: input.sessionId,
          userId: input.userId,
          currentStep: 0,
        },
      });

      // Increment view count
      await ctx.prisma.tour.update({
        where: { id: input.tourId },
        data: { viewCount: { increment: 1 } },
      });

      return progress;
    }),

  // Update tour progress
  updateProgress: publicProcedure
    .input(
      z.object({
        tourId: z.string(),
        sessionId: z.string(),
        currentStep: z.number().optional(),
        completed: z.boolean().optional(),
        dismissed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const progress = await ctx.prisma.tourProgress.update({
        where: {
          tourId_sessionId: {
            tourId: input.tourId,
            sessionId: input.sessionId,
          },
        },
        data: {
          currentStep: input.currentStep,
          completed: input.completed,
          dismissed: input.dismissed,
          completedAt: input.completed ? new Date() : undefined,
        },
      });

      // Update completion count if completed
      if (input.completed) {
        await ctx.prisma.tour.update({
          where: { id: input.tourId },
          data: { completionCount: { increment: 1 } },
        });
      }

      return progress;
    }),
});
