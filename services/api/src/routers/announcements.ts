import { z } from "zod";
import {
  router,
  projectProcedure,
  publicProcedure,
  sdkProcedure,
} from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

// Targeting schema
const targetingSchema = z.object({
  url: z.string().optional(),
  urlPattern: z.string().optional(),
  userTraits: z.record(z.any()).optional(),
  segment: z.string().optional(),
});

export const announcementsRouter = router({
  // ============================================================================
  // ANNOUNCEMENT CRUD
  // ============================================================================

  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        enabled: z.boolean().optional(),
        type: z.enum(["banner", "modal", "slideout", "feed_item"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const announcements = await ctx.prisma.announcement.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.type && { type: input.type }),
        },
        orderBy: { createdAt: "desc" },
      });

      return announcements;
    }),

  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const announcement = await ctx.prisma.announcement.findUnique({
        where: { id: input.id },
      });

      if (!announcement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Announcement not found",
        });
      }

      return announcement;
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        content: z.string(),
        type: z.enum(["banner", "modal", "slideout", "feed_item"]),
        style: z.enum(["info", "success", "warning", "celebration"]).optional(),
        image: z.string().optional(),
        actionLabel: z.string().optional(),
        actionUrl: z.string().optional(),
        targeting: targetingSchema.optional(),
        startAt: z.date().optional(),
        endAt: z.date().optional(),
        dismissible: z.boolean().default(true),
        showOnce: z.boolean().default(false),
        enabled: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const announcement = await ctx.prisma.announcement.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          content: input.content,
          type: input.type,
          style: input.style,
          image: input.image,
          actionLabel: input.actionLabel,
          actionUrl: input.actionUrl,
          targeting: input.targeting as any,
          startAt: input.startAt,
          endAt: input.endAt,
          dismissible: input.dismissible,
          showOnce: input.showOnce,
          enabled: input.enabled,
        },
      });

      return announcement;
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        type: z.enum(["banner", "modal", "slideout", "feed_item"]).optional(),
        style: z.enum(["info", "success", "warning", "celebration"]).optional(),
        image: z.string().nullable().optional(),
        actionLabel: z.string().nullable().optional(),
        actionUrl: z.string().nullable().optional(),
        targeting: targetingSchema.optional(),
        startAt: z.date().nullable().optional(),
        endAt: z.date().nullable().optional(),
        dismissible: z.boolean().optional(),
        showOnce: z.boolean().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const announcement = await ctx.prisma.announcement.update({
        where: { id },
        data: {
          ...data,
          targeting: data.targeting as any,
        },
      });

      return announcement;
    }),

  delete: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.announcement.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggle: projectProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const announcement = await ctx.prisma.announcement.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });

      return announcement;
    }),

  // ============================================================================
  // SDK ENDPOINTS
  // ============================================================================

  // Get active announcements for a session
  getActiveAnnouncements: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        sessionId: z.string(),
        url: z.string().optional(),
        userTraits: z.record(z.any()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      // Get all enabled announcements within date range
      const announcements = await ctx.prisma.announcement.findMany({
        where: {
          projectId: input.projectId,
          enabled: true,
          OR: [{ startAt: null }, { startAt: { lte: now } }],
          AND: [
            {
              OR: [{ endAt: null }, { endAt: { gte: now } }],
            },
          ],
        },
      });

      // Get dismissals for this session
      const dismissals = await ctx.prisma.announcementDismissal.findMany({
        where: {
          sessionId: input.sessionId,
          announcementId: { in: announcements.map((a) => a.id) },
        },
      });

      const dismissedIds = new Set(dismissals.map((d) => d.announcementId));

      // Filter announcements
      const eligibleAnnouncements = announcements.filter((announcement) => {
        // If showOnce and already dismissed, skip
        if (announcement.showOnce && dismissedIds.has(announcement.id)) {
          return false;
        }

        // Check URL targeting
        const targeting = announcement.targeting as any;
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

      // Increment view counts
      if (eligibleAnnouncements.length > 0) {
        await ctx.prisma.announcement.updateMany({
          where: { id: { in: eligibleAnnouncements.map((a) => a.id) } },
          data: { viewCount: { increment: 1 } },
        });
      }

      return eligibleAnnouncements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        style: announcement.style,
        image: announcement.image,
        actionLabel: announcement.actionLabel,
        actionUrl: announcement.actionUrl,
        dismissible: announcement.dismissible,
      }));
    }),

  // Track announcement action click
  trackClick: publicProcedure
    .input(
      z.object({
        announcementId: z.string(),
        sessionId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.announcement.update({
        where: { id: input.announcementId },
        data: { clickCount: { increment: 1 } },
      });

      return { success: true };
    }),

  // Dismiss announcement
  dismiss: publicProcedure
    .input(
      z.object({
        announcementId: z.string(),
        sessionId: z.string(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.announcementDismissal.upsert({
        where: {
          announcementId_sessionId: {
            announcementId: input.announcementId,
            sessionId: input.sessionId,
          },
        },
        update: {},
        create: {
          announcementId: input.announcementId,
          sessionId: input.sessionId,
          userId: input.userId,
        },
      });

      return { success: true };
    }),

  // ============================================================================
  // NEWS FEED
  // ============================================================================

  getNewsFeed: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const where: Prisma.AnnouncementWhereInput = {
        projectId: input.projectId,
        enabled: true,
        type: "feed_item",
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [
          {
            OR: [{ endAt: null }, { endAt: { gte: now } }],
          },
        ],
      };

      const [items, total] = await Promise.all([
        ctx.prisma.announcement.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.announcement.count({ where }),
      ]);

      return {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          style: item.style,
          image: item.image,
          actionLabel: item.actionLabel,
          actionUrl: item.actionUrl,
          createdAt: item.createdAt,
        })),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),
});
