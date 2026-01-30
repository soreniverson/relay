import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { router, projectProcedure, sdkProcedure } from "../lib/trpc";
import {
  createSurveySchema,
  updateSurveySchema,
  paginationSchema,
} from "@relay/shared";

export const surveysRouter = router({
  // List surveys (dashboard)
  list: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid() })
        .merge(paginationSchema)
        .extend({
          active: z.boolean().optional(),
        }),
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize, active } = input;

      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };

      if (active !== undefined) {
        where.active = active;
      }

      const [surveys, total] = await Promise.all([
        ctx.prisma.survey.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.survey.count({ where }),
      ]);

      return {
        data: surveys.map((s) => ({
          id: s.id,
          name: s.name,
          definition: s.definition,
          targeting: s.targeting,
          active: s.active,
          responseCount: s.responseCount,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
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

  // Get single survey with responses
  get: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid(), surveyId: z.string().uuid() }),
    )
    .query(async ({ input, ctx }) => {
      const survey = await ctx.prisma.survey.findUnique({
        where: { id: input.surveyId, projectId: ctx.projectId },
        include: {
          responses: {
            take: 100,
            orderBy: { createdAt: "desc" },
            include: {
              interaction: {
                select: {
                  id: true,
                  userId: true,
                  sessionId: true,
                  createdAt: true,
                  user: {
                    select: {
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!survey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Survey not found",
        });
      }

      return {
        id: survey.id,
        name: survey.name,
        definition: survey.definition,
        targeting: survey.targeting,
        active: survey.active,
        responseCount: survey.responseCount,
        responses: survey.responses.map((r) => ({
          id: r.id,
          responses: r.responses,
          createdAt: r.createdAt,
          user: r.interaction.user,
        })),
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt,
      };
    }),

  // Create survey
  create: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }).merge(createSurveySchema))
    .mutation(async ({ input, ctx }) => {
      const survey = await ctx.prisma.survey.create({
        data: {
          projectId: ctx.projectId,
          name: input.name,
          definition: input.definition as Prisma.InputJsonValue,
          targeting: input.targeting as Prisma.InputJsonValue,
          active: input.active ?? false,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "survey.created",
          targetType: "survey",
          targetId: survey.id,
        },
      });

      return survey;
    }),

  // Update survey
  update: projectProcedure
    .input(
      z
        .object({ projectId: z.string().uuid(), surveyId: z.string().uuid() })
        .merge(updateSurveySchema),
    )
    .mutation(async ({ input, ctx }) => {
      const survey = await ctx.prisma.survey.update({
        where: { id: input.surveyId, projectId: ctx.projectId },
        data: {
          name: input.name,
          definition: input.definition as Prisma.InputJsonValue | undefined,
          targeting: input.targeting as Prisma.InputJsonValue | undefined,
          active: input.active,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "survey.updated",
          targetType: "survey",
          targetId: survey.id,
        },
      });

      return survey;
    }),

  // Delete survey
  delete: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid(), surveyId: z.string().uuid() }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.survey.delete({
        where: { id: input.surveyId, projectId: ctx.projectId },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "survey.deleted",
          targetType: "survey",
          targetId: input.surveyId,
        },
      });

      return { success: true };
    }),

  // Toggle survey active status
  toggleActive: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        surveyId: z.string().uuid(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const survey = await ctx.prisma.survey.update({
        where: { id: input.surveyId, projectId: ctx.projectId },
        data: { active: input.active },
      });

      return { success: true, active: survey.active };
    }),

  // Get response analytics
  analytics: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid(), surveyId: z.string().uuid() }),
    )
    .query(async ({ input, ctx }) => {
      const survey = await ctx.prisma.survey.findUnique({
        where: { id: input.surveyId, projectId: ctx.projectId },
      });

      if (!survey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Survey not found",
        });
      }

      const responses = await ctx.prisma.surveyResponse.findMany({
        where: { surveyId: input.surveyId },
        select: { responses: true, createdAt: true },
      });

      // Aggregate responses by question
      const definition = survey.definition as {
        questions: Array<{ id: string; type: string; text: string }>;
      };
      const analytics: Record<string, unknown> = {};

      for (const question of definition.questions) {
        const questionResponses = responses
          .map((r) => {
            const respData = r.responses as Record<string, unknown>;
            return respData[question.id];
          })
          .filter(Boolean);

        if (question.type === "nps" || question.type === "rating") {
          const numericResponses = questionResponses
            .map(Number)
            .filter((n) => !isNaN(n));
          const avg =
            numericResponses.length > 0
              ? numericResponses.reduce((a, b) => a + b, 0) /
                numericResponses.length
              : 0;

          // For NPS, calculate score
          if (question.type === "nps") {
            const promoters = numericResponses.filter((n) => n >= 9).length;
            const detractors = numericResponses.filter((n) => n <= 6).length;
            const npsScore =
              numericResponses.length > 0
                ? Math.round(
                    ((promoters - detractors) / numericResponses.length) * 100,
                  )
                : 0;

            analytics[question.id] = {
              type: "nps",
              avg: Math.round(avg * 10) / 10,
              npsScore,
              promoters,
              passives: numericResponses.filter((n) => n >= 7 && n <= 8).length,
              detractors,
              total: numericResponses.length,
            };
          } else {
            analytics[question.id] = {
              type: "rating",
              avg: Math.round(avg * 10) / 10,
              distribution: [1, 2, 3, 4, 5].map((n) => ({
                value: n,
                count: numericResponses.filter((r) => r === n).length,
              })),
              total: numericResponses.length,
            };
          }
        } else if (
          question.type === "single_choice" ||
          question.type === "multi_choice"
        ) {
          const counts: Record<string, number> = {};
          questionResponses.forEach((r) => {
            const choices = Array.isArray(r) ? r : [r];
            choices.forEach((choice) => {
              counts[String(choice)] = (counts[String(choice)] || 0) + 1;
            });
          });

          analytics[question.id] = {
            type: question.type,
            distribution: Object.entries(counts).map(([value, count]) => ({
              value,
              count,
            })),
            total: questionResponses.length,
          };
        } else {
          // Text responses
          analytics[question.id] = {
            type: "text",
            responses: questionResponses.slice(0, 50), // Last 50 responses
            total: questionResponses.length,
          };
        }
      }

      return {
        surveyId: survey.id,
        responseCount: responses.length,
        analytics,
      };
    }),

  // Get active surveys for session (SDK)
  getActiveSurveys: sdkProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().optional(),
        url: z.string().url().optional(),
        traits: z.record(z.unknown()).optional(),
        triggerEvent: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Get active surveys
      const surveys = await ctx.prisma.survey.findMany({
        where: {
          projectId: ctx.projectId,
          active: true,
        },
      });

      // Get user traits if we have a user
      let userTraits: Record<string, unknown> = input.traits || {};
      if (input.userId) {
        const user = await ctx.prisma.endUser.findUnique({
          where: {
            projectId_externalUserId: {
              projectId: ctx.projectId,
              externalUserId: input.userId,
            },
          },
          select: { traits: true },
        });
        if (user?.traits) {
          userTraits = {
            ...((user.traits as Record<string, unknown>) || {}),
            ...userTraits,
          };
        }
      }

      // Get event counts if needed for event-based triggers
      const eventCounts: Record<string, number> = {};
      if (input.triggerEvent) {
        const count = await (ctx.prisma as any).userEvent.count({
          where: {
            projectId: ctx.projectId,
            sessionId: input.sessionId,
            name: input.triggerEvent,
          },
        });
        eventCounts[input.triggerEvent] = count;
      }

      // Filter by targeting
      const now = new Date();
      const eligibleSurveys = surveys.filter((survey) => {
        const targeting = survey.targeting as {
          startDate?: string;
          endDate?: string;
          showOnPages?: string[];
          excludePages?: string[];
          sampleRate?: number;
          userTraits?: Record<string, unknown>;
          triggerEvent?: string;
          triggerEventCount?: number;
        };

        // Date range
        if (targeting.startDate && new Date(targeting.startDate) > now)
          return false;
        if (targeting.endDate && new Date(targeting.endDate) < now)
          return false;

        // Page targeting
        if (input.url) {
          if (targeting.showOnPages && targeting.showOnPages.length > 0) {
            const matches = targeting.showOnPages.some((pattern) => {
              const regex = new RegExp(pattern.replace(/\*/g, ".*"));
              return regex.test(input.url!);
            });
            if (!matches) return false;
          }
          if (targeting.excludePages && targeting.excludePages.length > 0) {
            const matches = targeting.excludePages.some((pattern) => {
              const regex = new RegExp(pattern.replace(/\*/g, ".*"));
              return regex.test(input.url!);
            });
            if (matches) return false;
          }
        }

        // User trait targeting
        if (
          targeting.userTraits &&
          Object.keys(targeting.userTraits).length > 0
        ) {
          for (const [key, condition] of Object.entries(targeting.userTraits)) {
            const userValue = userTraits[key];

            if (typeof condition === "object" && condition !== null) {
              // Complex condition: { $gt, $lt, $contains, $in }
              const cond = condition as Record<string, unknown>;
              if (cond.$gt !== undefined && cond.$gt !== null) {
                if (
                  userValue === undefined ||
                  userValue === null ||
                  (userValue as number) <= (cond.$gt as number)
                )
                  return false;
              }
              if (cond.$lt !== undefined && cond.$lt !== null) {
                if (
                  userValue === undefined ||
                  userValue === null ||
                  (userValue as number) >= (cond.$lt as number)
                )
                  return false;
              }
              if (cond.$gte !== undefined && cond.$gte !== null) {
                if (
                  userValue === undefined ||
                  userValue === null ||
                  (userValue as number) < (cond.$gte as number)
                )
                  return false;
              }
              if (cond.$lte !== undefined && cond.$lte !== null) {
                if (
                  userValue === undefined ||
                  userValue === null ||
                  (userValue as number) > (cond.$lte as number)
                )
                  return false;
              }
              if (cond.$contains !== undefined) {
                if (
                  typeof userValue !== "string" ||
                  !userValue.includes(String(cond.$contains))
                )
                  return false;
              }
              if (cond.$in !== undefined && Array.isArray(cond.$in)) {
                if (!cond.$in.includes(userValue)) return false;
              }
              if (cond.$nin !== undefined && Array.isArray(cond.$nin)) {
                if (cond.$nin.includes(userValue)) return false;
              }
            } else {
              // Simple equality
              if (userValue !== condition) return false;
            }
          }
        }

        // Event-based trigger
        if (targeting.triggerEvent) {
          // If this is an event-triggered request, check if event matches
          if (input.triggerEvent !== targeting.triggerEvent) {
            return false;
          }
          // Check event count threshold
          const requiredCount = targeting.triggerEventCount || 1;
          const actualCount = eventCounts[targeting.triggerEvent] || 0;
          if (actualCount < requiredCount) return false;
        }

        // Sample rate
        if (targeting.sampleRate !== undefined && targeting.sampleRate < 1) {
          if (Math.random() > targeting.sampleRate) return false;
        }

        return true;
      });

      // Check which surveys the session has already responded to
      const respondedSurveyIds = await ctx.prisma.surveyResponse.findMany({
        where: {
          projectId: ctx.projectId,
          interaction: { sessionId: input.sessionId },
        },
        select: { surveyId: true, createdAt: true },
      });
      const respondedMap = new Map(
        respondedSurveyIds.map((r) => [r.surveyId, r.createdAt]),
      );

      // Count shows per survey for frequency caps (using response count as proxy)
      const showCountsResult = await ctx.prisma.surveyResponse.groupBy({
        by: ["surveyId"],
        where: {
          projectId: ctx.projectId,
          interaction: { sessionId: input.sessionId },
        },
        _count: true,
      });
      const showCounts = new Map(
        showCountsResult.map((r) => [r.surveyId, r._count]),
      );

      // Filter based on showOnce and frequency caps
      const finalSurveys = eligibleSurveys.filter((survey) => {
        const targeting = survey.targeting as {
          showOnce?: boolean;
          maxShowsPerUser?: number;
          minDaysBetweenShows?: number;
        };

        // Show once check
        if (targeting.showOnce && respondedMap.has(survey.id)) return false;

        // Max shows check
        if (targeting.maxShowsPerUser !== undefined) {
          const currentShows = showCounts.get(survey.id) || 0;
          if (currentShows >= targeting.maxShowsPerUser) return false;
        }

        // Min days between shows check
        if (targeting.minDaysBetweenShows !== undefined) {
          const lastShowDate = respondedMap.get(survey.id);
          if (lastShowDate) {
            const daysSinceLastShow =
              (now.getTime() - lastShowDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastShow < targeting.minDaysBetweenShows) return false;
          }
        }

        return true;
      });

      return finalSurveys.map((s) => ({
        id: s.id,
        name: s.name,
        definition: s.definition,
        targeting: s.targeting,
      }));
    }),

  // Submit survey response (SDK)
  respond: sdkProcedure
    .input(
      z.object({
        surveyId: z.string().uuid(),
        sessionId: z.string().uuid(),
        responses: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const survey = await ctx.prisma.survey.findUnique({
        where: { id: input.surveyId, projectId: ctx.projectId },
      });

      if (!survey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Survey not found",
        });
      }

      // Create interaction for the response
      const interaction = await ctx.prisma.interaction.create({
        data: {
          projectId: ctx.projectId,
          type: "survey",
          source: "widget",
          sessionId: input.sessionId,
          contentJson: {
            surveyId: input.surveyId,
            surveyName: survey.name,
            responses: input.responses,
          } as Prisma.InputJsonValue,
        },
      });

      // Create survey response
      await ctx.prisma.surveyResponse.create({
        data: {
          projectId: ctx.projectId,
          surveyId: input.surveyId,
          interactionId: interaction.id,
          responses: input.responses as Prisma.InputJsonValue,
        },
      });

      // Update response count
      await ctx.prisma.survey.update({
        where: { id: input.surveyId },
        data: { responseCount: { increment: 1 } },
      });

      return { success: true, interactionId: interaction.id };
    }),
});
