import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { router, projectProcedure } from "../lib/trpc";
import {
  createPrivacyRuleSchema,
  updatePrivacyRuleSchema,
  paginationSchema,
} from "@relay/shared";

export const privacyRouter = router({
  // List privacy rules
  listRules: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const rules = await ctx.prisma.privacyRule.findMany({
        where: { projectId: ctx.projectId },
        orderBy: { createdAt: "asc" },
      });

      return rules;
    }),

  // Create privacy rule
  createRule: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid() }).merge(createPrivacyRuleSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const rule = await ctx.prisma.privacyRule.create({
        data: {
          projectId: ctx.projectId,
          name: input.name,
          enabled: input.enabled,
          rule: input.rule,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "privacy_rule.created",
          targetType: "privacy_rule",
          targetId: rule.id,
        },
      });

      return rule;
    }),

  // Update privacy rule
  updateRule: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid(), ruleId: z.string().uuid() })
        .merge(updatePrivacyRuleSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const rule = await ctx.prisma.privacyRule.update({
        where: { id: input.ruleId, projectId: ctx.projectId },
        data: {
          name: input.name,
          enabled: input.enabled,
          rule: input.rule,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "privacy_rule.updated",
          targetType: "privacy_rule",
          targetId: rule.id,
        },
      });

      return rule;
    }),

  // Delete privacy rule
  deleteRule: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid(), ruleId: z.string().uuid() }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.privacyRule.delete({
        where: { id: input.ruleId, projectId: ctx.projectId },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "privacy_rule.deleted",
          targetType: "privacy_rule",
          targetId: input.ruleId,
        },
      });

      return { success: true };
    }),

  // Toggle privacy rule
  toggleRule: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        ruleId: z.string().uuid(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const rule = await ctx.prisma.privacyRule.update({
        where: { id: input.ruleId, projectId: ctx.projectId },
        data: { enabled: input.enabled },
      });

      return { success: true, enabled: rule.enabled };
    }),

  // Get audit logs
  getAuditLogs: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid() })
        .merge(paginationSchema)
        .extend({
          actorId: z.string().uuid().optional(),
          action: z.string().optional(),
          targetType: z.string().optional(),
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
      const {
        page,
        pageSize,
        actorId,
        action,
        targetType,
        startDate,
        endDate,
      } = input;

      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };

      if (actorId) where.actorId = actorId;
      if (action) where.action = { contains: action };
      if (targetType) where.targetType = targetType;
      if (startDate)
        where.createdAt = {
          ...((where.createdAt as Record<string, unknown>) || {}),
          gte: startDate,
        };
      if (endDate)
        where.createdAt = {
          ...((where.createdAt as Record<string, unknown>) || {}),
          lte: endDate,
        };

      const [logs, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.auditLog.count({ where }),
      ]);

      return {
        data: logs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasMore: page * pageSize < total,
        },
      };
    }),

  // Get capture inspector for an interaction
  getCaptureInspector: projectProcedure
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
          logs: true,
          media: true,
          replays: true,
        },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      const privacyScope = interaction.privacyScope as {
        capturedFields?: string[];
        maskedFields?: string[];
        blockedElements?: number;
      } | null;

      return {
        interaction: {
          id: interaction.id,
          type: interaction.type,
          createdAt: interaction.createdAt,
        },
        capturedData: {
          hasContentText: !!interaction.contentText,
          hasContentJson: !!interaction.contentJson,
          hasTechnicalContext: !!interaction.technicalContext,
          hasLogs: interaction.logs.length > 0,
          logDetails:
            interaction.logs.length > 0
              ? {
                  hasConsole: !!interaction.logs[0]?.console,
                  consoleCount:
                    (interaction.logs[0]?.console as Array<unknown>)?.length ||
                    0,
                  hasNetwork: !!interaction.logs[0]?.network,
                  networkCount:
                    (interaction.logs[0]?.network as Array<unknown>)?.length ||
                    0,
                  hasErrors: !!interaction.logs[0]?.errors,
                  errorCount:
                    (interaction.logs[0]?.errors as Array<unknown>)?.length ||
                    0,
                }
              : null,
          hasMedia: interaction.media.length > 0,
          mediaDetails: interaction.media.map((m) => ({
            kind: m.kind,
            contentType: m.contentType,
            sizeBytes: m.sizeBytes,
          })),
          hasReplay: interaction.replays.length > 0,
          replayDetails:
            interaction.replays.length > 0
              ? {
                  duration: interaction.replays[0].duration,
                  eventCount: interaction.replays[0].eventCount,
                  status: interaction.replays[0].status,
                }
              : null,
        },
        privacyScope: {
          capturedFields: privacyScope?.capturedFields || [],
          maskedFields: privacyScope?.maskedFields || [],
          blockedElements: privacyScope?.blockedElements || 0,
        },
        technicalContext: interaction.technicalContext
          ? {
              url: (interaction.technicalContext as Record<string, unknown>)
                .url,
              userAgent: (
                interaction.technicalContext as Record<string, unknown>
              ).userAgent,
              viewport: (
                interaction.technicalContext as Record<string, unknown>
              ).viewport,
              devicePixelRatio: (
                interaction.technicalContext as Record<string, unknown>
              ).devicePixelRatio,
            }
          : null,
      };
    }),

  // Update project privacy settings
  updateProjectSettings: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        privacyDefaults: z.object({
          maskInputs: z.boolean().optional(),
          maskEmails: z.boolean().optional(),
          maskNumbers: z.boolean().optional(),
          customMaskSelectors: z.array(z.string()).optional(),
          blockSelectors: z.array(z.string()).optional(),
        }),
        captureDefaults: z
          .object({
            console: z.boolean().optional(),
            network: z.boolean().optional(),
            dom: z.boolean().optional(),
            replay: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: ctx.projectId },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const currentSettings = project.settings as Record<string, unknown>;
      const newSettings = {
        ...currentSettings,
        privacyDefaults: {
          ...((currentSettings.privacyDefaults as Record<string, unknown>) ||
            {}),
          ...input.privacyDefaults,
        },
        captureDefaults: input.captureDefaults
          ? {
              ...((currentSettings.captureDefaults as Record<
                string,
                unknown
              >) || {}),
              ...input.captureDefaults,
            }
          : currentSettings.captureDefaults,
      };

      await ctx.prisma.project.update({
        where: { id: ctx.projectId },
        data: { settings: newSettings as Prisma.InputJsonValue },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "project.privacy_settings_updated",
          targetType: "project",
          targetId: ctx.projectId,
          meta: input,
        },
      });

      return { success: true };
    }),

  // Get data retention info
  getDataRetention: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      // Get counts and date ranges
      const [interactionStats, sessionStats, mediaStats] = await Promise.all([
        ctx.prisma.interaction.aggregate({
          where: { projectId: ctx.projectId },
          _count: true,
          _min: { createdAt: true },
          _max: { createdAt: true },
        }),
        ctx.prisma.session.aggregate({
          where: { projectId: ctx.projectId },
          _count: true,
          _min: { startedAt: true },
          _max: { lastSeenAt: true },
        }),
        ctx.prisma.media.aggregate({
          where: { projectId: ctx.projectId },
          _count: true,
          _sum: { sizeBytes: true },
        }),
      ]);

      return {
        interactions: {
          count: interactionStats._count,
          oldest: interactionStats._min.createdAt,
          newest: interactionStats._max.createdAt,
        },
        sessions: {
          count: sessionStats._count,
          oldest: sessionStats._min.startedAt,
          newest: sessionStats._max.lastSeenAt,
        },
        media: {
          count: mediaStats._count,
          totalSizeBytes: mediaStats._sum.sizeBytes || 0,
        },
      };
    }),

  // Request data export
  requestDataExport: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        format: z.enum(["json", "csv"]),
        includeMedia: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // In production, this would enqueue a worker job
      // to generate the export and email a download link

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "data.export_requested",
          targetType: "project",
          targetId: ctx.projectId,
          meta: {
            format: input.format,
            includeMedia: input.includeMedia,
          },
        },
      });

      // TODO: Enqueue export job
      ctx.logger.info({ projectId: ctx.projectId }, "Data export requested");

      return {
        success: true,
        message:
          "Export request received. You will receive an email when the export is ready.",
      };
    }),

  // Request data deletion
  requestDataDeletion: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        deleteType: z.enum(["user", "session", "all"]),
        userId: z.string().uuid().optional(),
        sessionId: z.string().uuid().optional(),
        confirm: z.literal(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Only project owners can request data deletion
      if (ctx.membership?.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only project owners can request data deletion",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "data.deletion_requested",
          targetType:
            input.deleteType === "user"
              ? "user"
              : input.deleteType === "session"
                ? "session"
                : "project",
          targetId: input.userId || input.sessionId || ctx.projectId,
          meta: input,
        },
      });

      // TODO: Enqueue deletion job (with confirmation period)
      ctx.logger.warn(
        { projectId: ctx.projectId, deleteType: input.deleteType },
        "Data deletion requested",
      );

      return {
        success: true,
        message:
          "Deletion request received. This action will be processed within 30 days.",
      };
    }),
});
