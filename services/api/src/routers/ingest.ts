import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { router, sdkProcedure, sdkProcedureWithRateLimit } from "../lib/trpc";
import {
  getBucketName,
  generateStorageKey,
  getPresignedUploadUrl,
  getExtensionFromContentType,
} from "../lib/storage";
import { pubsub } from "../lib/redis";
import {
  createInteractionSchema,
  createSessionSchema,
  updateSessionSchema,
  createLogsSchema,
  initiateUploadSchema,
  completeUploadSchema,
  startReplaySchema,
  replayChunkSchema,
  endReplaySchema,
} from "@relay/shared";
import { triggerWebhooks } from "../lib/webhook-delivery";
import { SlackClient } from "../lib/slack";

export const ingestRouter = router({
  // Create or update session
  session: sdkProcedureWithRateLimit(100, 60)
    .input(createSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const sessionId = input.id || crypto.randomUUID();

      // Check if user exists, create if needed
      let userId: string | null = null;
      if (input.userId) {
        let user = await ctx.prisma.endUser.findUnique({
          where: {
            projectId_externalUserId: {
              projectId: ctx.projectId,
              externalUserId: input.userId,
            },
          },
        });

        if (!user) {
          user = await ctx.prisma.endUser.create({
            data: {
              projectId: ctx.projectId,
              externalUserId: input.userId,
            },
          });
        }
        userId = user.id;
      }

      const session = await ctx.prisma.session.upsert({
        where: { id: sessionId },
        update: {
          lastSeenAt: new Date(),
          device: input.device,
          appVersion: input.appVersion,
          environment: input.environment,
          userAgent: input.userAgent,
        },
        create: {
          id: sessionId,
          projectId: ctx.projectId,
          userId,
          device: input.device,
          appVersion: input.appVersion,
          environment: input.environment,
          userAgent: input.userAgent,
        },
      });

      ctx.logger.debug({ sessionId }, "Session created/updated");

      return {
        sessionId: session.id,
        userId,
      };
    }),

  // Update session (heartbeat)
  updateSession: sdkProcedureWithRateLimit(200, 60)
    .input(updateSessionSchema)
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.session.update({
        where: {
          id: input.sessionId,
          projectId: ctx.projectId,
        },
        data: {
          lastSeenAt: input.lastSeenAt || new Date(),
          pageViews: input.pageViews
            ? { increment: input.pageViews }
            : undefined,
        },
      });

      return { success: true };
    }),

  // Create interaction (bug, feedback, etc.)
  interaction: sdkProcedureWithRateLimit(50, 60)
    .input(createInteractionSchema)
    .mutation(async ({ input, ctx }) => {
      const interactionId = input.id || crypto.randomUUID();

      // Resolve user ID if external user ID provided
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

      // Infer severity for bugs
      let severity = input.severity;
      if (input.type === "bug" && !severity) {
        // Basic severity inference from content
        const text = (input.contentText || "").toLowerCase();
        const content = input.content;

        if (
          text.includes("crash") ||
          text.includes("critical") ||
          text.includes("urgent")
        ) {
          severity = "critical";
        } else if (
          text.includes("error") ||
          text.includes("broken") ||
          text.includes("fail")
        ) {
          severity = "high";
        } else if (
          text.includes("slow") ||
          text.includes("performance") ||
          text.includes("issue")
        ) {
          severity = "med";
        } else {
          severity = "low";
        }
      }

      const interaction = await ctx.prisma.interaction.create({
        data: {
          id: interactionId,
          projectId: ctx.projectId,
          type: input.type,
          source: input.source,
          userId: internalUserId,
          sessionId: input.sessionId,
          contentText: input.contentText,
          contentJson: (input.content || {}) as Prisma.InputJsonValue,
          severity,
          tags: input.tags || [],
          technicalContext: input.technicalContext || {},
        },
      });

      // Update session interaction count
      await ctx.prisma.session.update({
        where: { id: input.sessionId },
        data: { interactionCount: { increment: 1 } },
      });

      // Update usage metrics for billing
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      await ctx.prisma.usageMetrics.upsert({
        where: {
          projectId_periodStart: {
            projectId: ctx.projectId,
            periodStart,
          },
        },
        update: {
          interactions: { increment: 1 },
        },
        create: {
          projectId: ctx.projectId,
          periodStart,
          periodEnd,
          interactions: 1,
        },
      });

      // Publish realtime event
      await pubsub.publish(`project:${ctx.projectId}`, {
        type: "interaction.created",
        projectId: ctx.projectId,
        payload: {
          id: interaction.id,
          type: interaction.type,
          status: interaction.status,
          createdAt: interaction.createdAt,
        },
      });

      // Get user info for notifications
      let userInfo: { email?: string; name?: string } = {};
      if (internalUserId) {
        const user = await ctx.prisma.endUser.findUnique({
          where: { id: internalUserId },
          select: { email: true, name: true },
        });
        userInfo = {
          email: user?.email || undefined,
          name: user?.name || undefined,
        };
      }

      const content = input.content as Record<string, unknown> | undefined;
      const technicalContext = input.technicalContext as
        | Record<string, unknown>
        | undefined;
      const dashboardUrl = process.env.DASHBOARD_URL || "https://app.relay.dev";
      const relayUrl = `${dashboardUrl}/dashboard/inbox?id=${interaction.id}`;

      // Trigger webhooks
      const webhookEvent =
        input.type === "bug"
          ? "bug.reported"
          : input.type === "feedback"
            ? "feedback.received"
            : "interaction.created";

      triggerWebhooks(ctx.prisma, ctx.projectId, webhookEvent, {
        id: interaction.id,
        type: interaction.type,
        status: interaction.status,
        severity: interaction.severity,
        userId: internalUserId,
        sessionId: input.sessionId,
        contentText: input.contentText,
        createdAt: interaction.createdAt.toISOString(),
        url: technicalContext?.url as string | undefined,
      }).catch((err) => {
        ctx.logger.error({ err }, "Failed to trigger webhooks");
      });

      // Send Slack notification if configured
      const slackIntegration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "slack",
          },
        },
      });

      if (slackIntegration?.enabled) {
        const slackConfig = slackIntegration.config as {
          webhookUrl?: string;
          notifyOn?: {
            newBug?: boolean;
            highSeverity?: boolean;
            newFeedback?: boolean;
            newChat?: boolean;
          };
        };

        if (slackConfig.webhookUrl) {
          const notifyOn = slackConfig.notifyOn || {};
          const shouldNotify =
            (input.type === "bug" && notifyOn.newBug) ||
            (input.type === "feedback" && notifyOn.newFeedback) ||
            (input.type === "chat" && notifyOn.newChat) ||
            ((severity === "critical" || severity === "high") &&
              notifyOn.highSeverity);

          if (shouldNotify) {
            const slackClient = new SlackClient({
              webhookUrl: slackConfig.webhookUrl,
            });

            if (
              (severity === "critical" || severity === "high") &&
              notifyOn.highSeverity
            ) {
              slackClient
                .sendHighSeverityAlert({
                  title: content?.title as string | undefined,
                  description: input.contentText,
                  severity: severity!,
                  userName: userInfo.name,
                  userEmail: userInfo.email,
                  url: (technicalContext?.url as string) || "",
                  relayUrl,
                })
                .catch((err) => {
                  ctx.logger.error(
                    { err },
                    "Failed to send Slack notification",
                  );
                });
            } else if (input.type === "bug" || input.type === "feedback") {
              slackClient
                .sendInteractionNotification({
                  type: input.type as "bug" | "feedback",
                  title: content?.title as string | undefined,
                  description: input.contentText,
                  severity,
                  userName: userInfo.name,
                  userEmail: userInfo.email,
                  url: (technicalContext?.url as string) || "",
                  relayUrl,
                })
                .catch((err) => {
                  ctx.logger.error(
                    { err },
                    "Failed to send Slack notification",
                  );
                });
            }
          }
        }
      }

      ctx.logger.info(
        { interactionId, type: input.type },
        "Interaction created",
      );

      return {
        interactionId: interaction.id,
      };
    }),

  // Store logs for interaction
  logs: sdkProcedureWithRateLimit(50, 60)
    .input(createLogsSchema)
    .mutation(async ({ input, ctx }) => {
      // Verify interaction belongs to project
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      const logs = await ctx.prisma.interactionLog.create({
        data: {
          projectId: ctx.projectId,
          interactionId: input.interactionId,
          console: (input.console || []) as Prisma.InputJsonValue,
          network: (input.network || []) as Prisma.InputJsonValue,
          errors: (input.errors || []) as Prisma.InputJsonValue,
        },
      });

      // Check for errors and potentially bump severity
      if (input.errors && input.errors.length > 0) {
        const hasPaymentError = input.errors.some(
          (e) =>
            e.message.toLowerCase().includes("payment") ||
            e.message.toLowerCase().includes("checkout") ||
            e.message.toLowerCase().includes("billing"),
        );

        const hasAuthError = input.errors.some(
          (e) =>
            e.message.toLowerCase().includes("auth") ||
            e.message.toLowerCase().includes("login") ||
            e.message.toLowerCase().includes("permission"),
        );

        if (hasPaymentError || hasAuthError) {
          // Bump severity if not already high
          if (
            interaction.severity === "low" ||
            interaction.severity === "med"
          ) {
            await ctx.prisma.interaction.update({
              where: { id: input.interactionId },
              data: { severity: "high" },
            });
          }
        }
      }

      ctx.logger.debug({ interactionId: input.interactionId }, "Logs stored");

      return { logsId: logs.id };
    }),

  // Initiate media upload
  initiateUpload: sdkProcedureWithRateLimit(20, 60)
    .input(initiateUploadSchema)
    .mutation(async ({ input, ctx }) => {
      // Verify interaction belongs to project
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Generate storage key
      const extension = getExtensionFromContentType(input.contentType);
      const storageKey = generateStorageKey(
        ctx.projectId,
        input.kind,
        extension,
      );
      const bucket = getBucketName(ctx.region, "media");

      // Get presigned upload URL
      const uploadUrl = await getPresignedUploadUrl(
        bucket,
        storageKey,
        input.contentType,
      );

      // Create media record
      const media = await ctx.prisma.media.create({
        data: {
          projectId: ctx.projectId,
          interactionId: input.interactionId,
          kind: input.kind,
          url: "", // Will be filled after upload complete
          storageKey,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          meta: {
            processingStatus: "pending",
            filename: input.filename,
          },
        },
      });

      ctx.logger.debug(
        { mediaId: media.id, kind: input.kind },
        "Upload initiated",
      );

      return {
        mediaId: media.id,
        uploadUrl,
        uploadHeaders: {
          "Content-Type": input.contentType,
        },
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      };
    }),

  // Complete media upload
  completeUpload: sdkProcedureWithRateLimit(20, 60)
    .input(completeUploadSchema)
    .mutation(async ({ input, ctx }) => {
      const media = await ctx.prisma.media.findUnique({
        where: { id: input.mediaId, projectId: ctx.projectId },
      });

      if (!media) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Media not found",
        });
      }

      // Generate CDN URL (in production this would be CloudFront/CDN URL)
      const bucket = getBucketName(ctx.region, "media");
      const url = `${process.env.STORAGE_URL || "http://localhost:9000"}/${bucket}/${media.storageKey}`;

      await ctx.prisma.media.update({
        where: { id: input.mediaId },
        data: {
          url,
          meta: {
            ...((media.meta as Record<string, unknown>) || {}),
            processingStatus: "complete",
          },
        },
      });

      ctx.logger.debug({ mediaId: media.id }, "Upload completed");

      return { success: true, url };
    }),

  // Start replay recording
  startReplay: sdkProcedureWithRateLimit(10, 60)
    .input(startReplaySchema)
    .mutation(async ({ input, ctx }) => {
      const replay = await ctx.prisma.replay.create({
        data: {
          projectId: ctx.projectId,
          sessionId: input.sessionId,
          interactionId: input.interactionId,
          status: "recording",
          chunks: [],
        },
      });

      ctx.logger.debug({ replayId: replay.id }, "Replay started");

      return { replayId: replay.id };
    }),

  // Upload replay chunk
  replayChunk: sdkProcedureWithRateLimit(60, 60)
    .input(replayChunkSchema)
    .mutation(async ({ input, ctx }) => {
      const replay = await ctx.prisma.replay.findUnique({
        where: { id: input.replayId, projectId: ctx.projectId },
      });

      if (!replay) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Replay session not found",
        });
      }

      if (replay.status !== "recording") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Replay is not in recording state",
        });
      }

      // Store chunk in object storage
      const bucket = getBucketName(ctx.region, "replay");
      const storageKey = `${ctx.projectId}/${replay.id}/chunk-${input.chunkIndex}.json`;
      const uploadUrl = await getPresignedUploadUrl(
        bucket,
        storageKey,
        "application/json",
      );

      // Update chunks array
      const existingChunks =
        (replay.chunks as Array<Record<string, unknown>>) || [];
      const newChunk = {
        index: input.chunkIndex,
        storageKey,
        eventCount: input.events.length,
        startTime: input.startTime,
        endTime: input.endTime,
      };

      await ctx.prisma.replay.update({
        where: { id: input.replayId },
        data: {
          chunks: [...existingChunks, newChunk] as Prisma.InputJsonValue,
          eventCount: { increment: input.events.length },
        },
      });

      return { uploadUrl };
    }),

  // End replay recording
  endReplay: sdkProcedureWithRateLimit(10, 60)
    .input(endReplaySchema)
    .mutation(async ({ input, ctx }) => {
      const replay = await ctx.prisma.replay.findUnique({
        where: { id: input.replayId, projectId: ctx.projectId },
      });

      if (!replay) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Replay session not found",
        });
      }

      const chunks =
        (replay.chunks as Array<{ startTime: number; endTime: number }>) || [];
      const duration =
        chunks.length > 0
          ? chunks[chunks.length - 1].endTime - chunks[0].startTime
          : 0;

      await ctx.prisma.replay.update({
        where: { id: input.replayId },
        data: {
          status: "processing",
          endedAt: new Date(),
          duration,
          eventCount: input.totalEventCount,
        },
      });

      // TODO: Enqueue worker job to process replay
      // For now, mark as ready immediately
      await ctx.prisma.replay.update({
        where: { id: input.replayId },
        data: { status: "ready" },
      });

      ctx.logger.info(
        {
          replayId: input.replayId,
          duration,
          eventCount: input.totalEventCount,
        },
        "Replay ended",
      );

      return { success: true };
    }),

  // Identify user (link session to user)
  identify: sdkProcedureWithRateLimit(50, 60)
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().min(1).max(255),
        email: z.string().email().optional(),
        name: z.string().max(255).optional(),
        traits: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Find or create user
      let user = await ctx.prisma.endUser.findUnique({
        where: {
          projectId_externalUserId: {
            projectId: ctx.projectId,
            externalUserId: input.userId,
          },
        },
      });

      if (user) {
        // Update existing user
        user = await ctx.prisma.endUser.update({
          where: { id: user.id },
          data: {
            email: input.email || user.email,
            name: input.name || user.name,
            traits: {
              ...((user.traits as Record<string, unknown>) || {}),
              ...input.traits,
            } as Prisma.InputJsonValue,
          },
        });
      } else {
        // Create new user
        user = await ctx.prisma.endUser.create({
          data: {
            projectId: ctx.projectId,
            externalUserId: input.userId,
            email: input.email,
            name: input.name,
            traits: (input.traits || {}) as Prisma.InputJsonValue,
          },
        });
      }

      // Link session to user
      await ctx.prisma.session.update({
        where: { id: input.sessionId, projectId: ctx.projectId },
        data: { userId: user.id },
      });

      ctx.logger.debug(
        { sessionId: input.sessionId, userId: user.id },
        "User identified",
      );

      return { userId: user.id };
    }),

  // Track event (for survey targeting and analytics)
  track: sdkProcedureWithRateLimit(100, 60)
    .input(
      z.object({
        sessionId: z.string().uuid(),
        event: z.string().max(200),
        properties: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Get user ID from session
      const session = await ctx.prisma.session.findUnique({
        where: { id: input.sessionId, projectId: ctx.projectId },
        select: { userId: true },
      });

      // Store event in UserEvent table
      await (ctx.prisma as any).userEvent.create({
        data: {
          projectId: ctx.projectId,
          sessionId: input.sessionId,
          userId: session?.userId,
          name: input.event,
          properties: (input.properties || {}) as Prisma.InputJsonValue,
        },
      });

      ctx.logger.debug(
        { sessionId: input.sessionId, event: input.event },
        "Event tracked",
      );

      return { success: true };
    }),

  // Batch track events (for efficiency)
  trackBatch: sdkProcedureWithRateLimit(20, 60)
    .input(
      z.object({
        sessionId: z.string().uuid(),
        events: z
          .array(
            z.object({
              event: z.string().max(200),
              properties: z.record(z.unknown()).optional(),
              timestamp: z.number().optional(),
            }),
          )
          .max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Get user ID from session
      const session = await ctx.prisma.session.findUnique({
        where: { id: input.sessionId, projectId: ctx.projectId },
        select: { userId: true },
      });

      // Batch insert events
      await (ctx.prisma as any).userEvent.createMany({
        data: input.events.map((e) => ({
          projectId: ctx.projectId,
          sessionId: input.sessionId,
          userId: session?.userId,
          name: e.event,
          properties: (e.properties || {}) as Prisma.InputJsonValue,
          createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
        })),
      });

      ctx.logger.debug(
        { sessionId: input.sessionId, eventCount: input.events.length },
        "Events batch tracked",
      );

      return { success: true, count: input.events.length };
    }),
});
