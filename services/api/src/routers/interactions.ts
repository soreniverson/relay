import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure } from "../lib/trpc";
import { pubsub } from "../lib/redis";
import { getPresignedDownloadUrl, getBucketName } from "../lib/storage";
import {
  inboxQuerySchema,
  interactionStatusSchema,
  severitySchema,
} from "@relay/shared";

export const interactionsRouter = router({
  // Get inbox (paginated interactions)
  inbox: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }).merge(inboxQuerySchema))
    .query(async ({ input, ctx }) => {
      const {
        page,
        pageSize,
        types,
        statuses,
        severities,
        tags,
        assigneeId,
        userId,
        sessionId,
        startDate,
        endDate,
        search,
        hasReplay,
        field,
        direction,
      } = input;

      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };

      // Apply filters
      if (types && types.length > 0) {
        where.type = { in: types };
      }
      if (statuses && statuses.length > 0) {
        where.status = { in: statuses };
      }
      if (severities && severities.length > 0) {
        where.severity = { in: severities };
      }
      if (tags && tags.length > 0) {
        where.tags = { hasEvery: tags };
      }
      if (assigneeId) {
        where.assigneeId = assigneeId;
      }
      if (userId) {
        where.userId = userId;
      }
      if (sessionId) {
        where.sessionId = sessionId;
      }
      if (startDate) {
        where.createdAt = {
          ...((where.createdAt as Record<string, unknown>) || {}),
          gte: startDate,
        };
      }
      if (endDate) {
        where.createdAt = {
          ...((where.createdAt as Record<string, unknown>) || {}),
          lte: endDate,
        };
      }
      if (search) {
        where.OR = [
          { contentText: { contains: search, mode: "insensitive" } },
          { contentJson: { path: ["title"], string_contains: search } },
        ];
      }
      if (hasReplay) {
        where.replays = { some: {} };
      }

      const [interactions, total] = await Promise.all([
        ctx.prisma.interaction.findMany({
          where,
          orderBy: { [field]: direction },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: {
              select: {
                id: true,
                externalUserId: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
            session: {
              select: {
                id: true,
                device: true,
                appVersion: true,
                environment: true,
              },
            },
            media: {
              select: {
                id: true,
                kind: true,
                contentType: true,
                sizeBytes: true,
              },
            },
            _count: {
              select: {
                replays: true,
                logs: true,
              },
            },
          },
        }),
        ctx.prisma.interaction.count({ where }),
      ]);

      return {
        data: interactions.map((i) => ({
          id: i.id,
          type: i.type,
          source: i.source,
          status: i.status,
          severity: i.severity,
          tags: i.tags,
          contentText: i.contentText,
          content: i.contentJson,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          user: i.user,
          session: i.session,
          media: i.media,
          hasReplay: i._count.replays > 0,
          hasLogs: i._count.logs > 0,
          aiSummary: i.aiSummary,
          aiLabels: i.aiLabels,
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

  // Get single interaction with all details
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
        include: {
          user: true,
          session: true,
          media: true,
          logs: true,
          replays: {
            where: { status: "ready" },
            orderBy: { startedAt: "desc" },
            take: 1,
          },
          feedbackLinks: {
            include: {
              feedbackItem: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
          integrationLinks: {
            select: {
              id: true,
              provider: true,
              externalId: true,
              externalUrl: true,
            },
          },
        },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Generate presigned URLs for media
      const mediaWithUrls = await Promise.all(
        interaction.media.map(async (m) => {
          const signedUrl = await getPresignedDownloadUrl(
            getBucketName(ctx.region, "media"),
            m.storageKey,
            3600,
          );
          return { ...m, signedUrl };
        }),
      );

      return {
        ...interaction,
        media: mediaWithUrls,
        replay: interaction.replays[0] || null,
      };
    }),

  // Update interaction status
  updateStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
        status: interactionStatusSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const interaction = await ctx.prisma.interaction.update({
        where: { id: input.interactionId, projectId: ctx.projectId },
        data: { status: input.status },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "interaction.status_changed",
          targetType: "interaction",
          targetId: input.interactionId,
          meta: { newStatus: input.status },
        },
      });

      // Publish realtime event
      await pubsub.publish(`project:${ctx.projectId}`, {
        type: "interaction.updated",
        projectId: ctx.projectId,
        payload: {
          id: interaction.id,
          status: interaction.status,
        },
      });

      return { success: true };
    }),

  // Update interaction severity
  updateSeverity: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
        severity: severitySchema.nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const interaction = await ctx.prisma.interaction.update({
        where: { id: input.interactionId, projectId: ctx.projectId },
        data: { severity: input.severity },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "interaction.severity_changed",
          targetType: "interaction",
          targetId: input.interactionId,
          meta: { newSeverity: input.severity },
        },
      });

      return { success: true };
    }),

  // Assign interaction
  assign: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
        assigneeId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const interaction = await ctx.prisma.interaction.update({
        where: { id: input.interactionId, projectId: ctx.projectId },
        data: { assigneeId: input.assigneeId },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "interaction.assigned",
          targetType: "interaction",
          targetId: input.interactionId,
          meta: { assigneeId: input.assigneeId },
        },
      });

      return { success: true };
    }),

  // Update tags
  updateTags: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
        tags: z.array(z.string().max(100)),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.interaction.update({
        where: { id: input.interactionId, projectId: ctx.projectId },
        data: { tags: input.tags },
      });

      return { success: true };
    }),

  // Bulk update status
  bulkUpdateStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionIds: z.array(z.string().uuid()),
        status: interactionStatusSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.interaction.updateMany({
        where: {
          id: { in: input.interactionIds },
          projectId: ctx.projectId,
        },
        data: { status: input.status },
      });

      // Create audit logs
      for (const interactionId of input.interactionIds) {
        await ctx.prisma.auditLog.create({
          data: {
            projectId: ctx.projectId,
            actorType: "admin",
            actorId: ctx.adminUser!.id,
            action: "interaction.status_changed",
            targetType: "interaction",
            targetId: interactionId,
            meta: { newStatus: input.status, bulk: true },
          },
        });
      }

      return { success: true, count: input.interactionIds.length };
    }),

  // Get replay data
  getReplay: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid(), replayId: z.string().uuid() }),
    )
    .query(async ({ input, ctx }) => {
      const replay = await ctx.prisma.replay.findUnique({
        where: { id: input.replayId, projectId: ctx.projectId },
        include: {
          session: true,
          interaction: true,
        },
      });

      if (!replay) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Replay not found",
        });
      }

      // Generate signed URLs for chunks
      const chunks =
        (replay.chunks as Array<{
          index: number;
          storageKey: string;
          eventCount: number;
          startTime: number;
          endTime: number;
        }>) || [];
      const chunksWithUrls = await Promise.all(
        chunks.map(async (chunk) => {
          const signedUrl = await getPresignedDownloadUrl(
            getBucketName(ctx.region, "replay"),
            chunk.storageKey,
            3600,
          );
          return { ...chunk, signedUrl };
        }),
      );

      return {
        id: replay.id,
        sessionId: replay.sessionId,
        interactionId: replay.interactionId,
        startedAt: replay.startedAt,
        endedAt: replay.endedAt,
        duration: replay.duration,
        eventCount: replay.eventCount,
        status: replay.status,
        chunks: chunksWithUrls,
        session: replay.session,
      };
    }),

  // Get duplicate suggestions
  getDuplicates: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Find interactions with same duplicate group
      if (interaction.aiDuplicateGroupId) {
        const duplicates = await ctx.prisma.interaction.findMany({
          where: {
            projectId: ctx.projectId,
            aiDuplicateGroupId: interaction.aiDuplicateGroupId,
            id: { not: input.interactionId },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            status: true,
            contentText: true,
            createdAt: true,
          },
        });

        return { duplicates, groupId: interaction.aiDuplicateGroupId };
      }

      return { duplicates: [], groupId: null };
    }),

  // Merge duplicates
  mergeDuplicates: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        primaryId: z.string().uuid(),
        duplicateIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Close duplicates and link to primary
      await ctx.prisma.interaction.updateMany({
        where: {
          id: { in: input.duplicateIds },
          projectId: ctx.projectId,
        },
        data: {
          status: "closed",
          tags: {
            push: `merged:${input.primaryId}`,
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "interaction.merged",
          targetType: "interaction",
          targetId: input.primaryId,
          meta: { duplicateIds: input.duplicateIds },
        },
      });

      return { success: true };
    }),

  // Get interaction timeline/activity
  getActivity: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Get audit logs for this interaction
      const auditLogs = await ctx.prisma.auditLog.findMany({
        where: {
          projectId: ctx.projectId,
          targetType: "interaction",
          targetId: input.interactionId,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorType: log.actorType,
        actorId: log.actorId,
        meta: log.meta,
        createdAt: log.createdAt,
      }));
    }),
});
