import { z } from "zod";
import { router, projectProcedure } from "../lib/trpc";

// Helper to calculate percentage change
const calcChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const analyticsRouter = router({
  // Get overview stats for the dashboard
  // OPTIMIZED: Uses 4 queries instead of 12 by aggregating with raw SQL
  getOverview: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodDays = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const prevStartDate = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Single query to get all interaction counts for both periods
      const interactionStats = await ctx.prisma.$queryRaw<
        Array<{
          period: string;
          total: bigint;
          bugs: bigint;
          feedback: bigint;
        }>
      >`
        SELECT
          CASE
            WHEN created_at >= ${startDate} THEN 'current'
            ELSE 'previous'
          END as period,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE type = 'bug') as bugs,
          COUNT(*) FILTER (WHERE type = 'feedback') as feedback
        FROM interactions
        WHERE project_id = ${input.projectId}
          AND created_at >= ${prevStartDate}
        GROUP BY period
      `;

      // Get session, user, and conversation counts in parallel (3 queries instead of 6)
      const [sessionStats, userStats, conversationStats] = await Promise.all([
        ctx.prisma.$queryRaw<Array<{ period: string; count: bigint }>>`
          SELECT
            CASE WHEN started_at >= ${startDate} THEN 'current' ELSE 'previous' END as period,
            COUNT(*) as count
          FROM sessions
          WHERE project_id = ${input.projectId}
            AND started_at >= ${prevStartDate}
          GROUP BY period
        `,
        ctx.prisma.$queryRaw<Array<{ period: string; count: bigint }>>`
          SELECT
            CASE WHEN created_at >= ${startDate} THEN 'current' ELSE 'previous' END as period,
            COUNT(*) as count
          FROM end_users
          WHERE project_id = ${input.projectId}
            AND created_at >= ${prevStartDate}
          GROUP BY period
        `,
        ctx.prisma.$queryRaw<Array<{ period: string; count: bigint }>>`
          SELECT
            CASE WHEN created_at >= ${startDate} THEN 'current' ELSE 'previous' END as period,
            COUNT(*) as count
          FROM conversations
          WHERE project_id = ${input.projectId}
            AND created_at >= ${prevStartDate}
          GROUP BY period
        `,
      ]);

      // Extract counts from results
      const currentInteractions = interactionStats.find(s => s.period === 'current');
      const prevInteractions = interactionStats.find(s => s.period === 'previous');
      const currentSessions = sessionStats.find(s => s.period === 'current');
      const prevSessions = sessionStats.find(s => s.period === 'previous');
      const currentUsers = userStats.find(s => s.period === 'current');
      const prevUsers = userStats.find(s => s.period === 'previous');
      const currentConvs = conversationStats.find(s => s.period === 'current');
      const prevConvs = conversationStats.find(s => s.period === 'previous');

      const interactionCount = Number(currentInteractions?.total || 0);
      const bugCount = Number(currentInteractions?.bugs || 0);
      const feedbackCount = Number(currentInteractions?.feedback || 0);
      const sessionCount = Number(currentSessions?.count || 0);
      const userCount = Number(currentUsers?.count || 0);
      const conversationCount = Number(currentConvs?.count || 0);

      const prevInteractionCount = Number(prevInteractions?.total || 0);
      const prevBugCount = Number(prevInteractions?.bugs || 0);
      const prevFeedbackCount = Number(prevInteractions?.feedback || 0);
      const prevSessionCount = Number(prevSessions?.count || 0);
      const prevUserCount = Number(prevUsers?.count || 0);
      const prevConversationCount = Number(prevConvs?.count || 0);

      return {
        interactions: { count: interactionCount, change: calcChange(interactionCount, prevInteractionCount) },
        bugs: { count: bugCount, change: calcChange(bugCount, prevBugCount) },
        feedback: { count: feedbackCount, change: calcChange(feedbackCount, prevFeedbackCount) },
        conversations: { count: conversationCount, change: calcChange(conversationCount, prevConversationCount) },
        sessions: { count: sessionCount, change: calcChange(sessionCount, prevSessionCount) },
        users: { count: userCount, change: calcChange(userCount, prevUserCount) },
      };
    }),

  // Get time series data for charts
  getTimeSeries: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
        metric: z.enum(["interactions", "bugs", "feedback", "sessions", "users"]).default("interactions"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodDays = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Get daily counts using raw SQL for better performance
      let result: { date: Date; count: bigint }[];

      if (input.metric === "interactions") {
        result = await ctx.prisma.$queryRaw`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM interactions
          WHERE project_id = ${input.projectId}
            AND created_at >= ${startDate}
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
      } else if (input.metric === "bugs") {
        result = await ctx.prisma.$queryRaw`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM interactions
          WHERE project_id = ${input.projectId}
            AND type = 'bug'
            AND created_at >= ${startDate}
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
      } else if (input.metric === "feedback") {
        result = await ctx.prisma.$queryRaw`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM interactions
          WHERE project_id = ${input.projectId}
            AND type = 'feedback'
            AND created_at >= ${startDate}
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
      } else if (input.metric === "sessions") {
        result = await ctx.prisma.$queryRaw`
          SELECT DATE(started_at) as date, COUNT(*) as count
          FROM sessions
          WHERE project_id = ${input.projectId}
            AND started_at >= ${startDate}
          GROUP BY DATE(started_at)
          ORDER BY date
        `;
      } else {
        result = await ctx.prisma.$queryRaw`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM end_users
          WHERE project_id = ${input.projectId}
            AND created_at >= ${startDate}
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
      }

      // Fill in missing dates with 0
      const dateMap = new Map<string, number>();
      result.forEach((r) => {
        const dateStr = new Date(r.date).toISOString().split("T")[0];
        dateMap.set(dateStr, Number(r.count));
      });

      const data: { date: string; count: number }[] = [];
      for (let i = 0; i < periodDays; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        data.push({
          date: dateStr,
          count: dateMap.get(dateStr) || 0,
        });
      }

      return data;
    }),

  // Get interaction breakdown by type
  getInteractionBreakdown: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodDays = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const breakdown = await ctx.prisma.interaction.groupBy({
        by: ["type"],
        where: { projectId: input.projectId, createdAt: { gte: startDate } },
        _count: true,
      });

      return breakdown.map((b) => ({
        type: b.type,
        count: b._count,
      }));
    }),

  // Get bug severity distribution
  getBugSeverity: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodDays = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const severity = await ctx.prisma.interaction.groupBy({
        by: ["severity"],
        where: {
          projectId: input.projectId,
          type: "bug",
          createdAt: { gte: startDate },
        },
        _count: true,
      });

      return severity.map((s) => ({
        severity: s.severity || "unset",
        count: s._count,
      }));
    }),

  // Get interaction status distribution
  getStatusDistribution: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodDays = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const statuses = await ctx.prisma.interaction.groupBy({
        by: ["status"],
        where: { projectId: input.projectId, createdAt: { gte: startDate } },
        _count: true,
      });

      return statuses.map((s) => ({
        status: s.status,
        count: s._count,
      }));
    }),

  // Get top feedback items by votes
  getTopFeedback: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.feedbackItem.findMany({
        where: { projectId: input.projectId },
        orderBy: { voteCount: "desc" },
        take: input.limit,
        select: {
          id: true,
          title: true,
          voteCount: true,
          status: true,
        },
      });

      return items;
    }),

  // Get survey response rates
  getSurveyStats: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const surveys = await ctx.prisma.survey.findMany({
        where: { projectId: input.projectId },
        select: {
          id: true,
          name: true,
          responseCount: true,
          active: true,
        },
        orderBy: { responseCount: "desc" },
        take: 10,
      });

      const totalResponses = surveys.reduce((sum, s) => sum + s.responseCount, 0);
      const activeSurveys = surveys.filter((s) => s.active).length;

      return {
        surveys,
        totalResponses,
        activeSurveys,
      };
    }),

  // Get resolution time metrics
  // OPTIMIZED: Uses SQL aggregation instead of fetching all records
  getResolutionMetrics: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        period: z.enum(["7d", "30d", "90d"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const periodDays = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Use SQL aggregation to calculate average resolution time
      const [resolutionStats, pendingCount] = await Promise.all([
        ctx.prisma.$queryRaw<
          Array<{ resolved_count: bigint; avg_hours: number | null }>
        >`
          SELECT
            COUNT(*) as resolved_count,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours
          FROM interactions
          WHERE project_id = ${input.projectId}
            AND status IN ('resolved', 'closed')
            AND updated_at >= ${startDate}
        `,
        ctx.prisma.interaction.count({
          where: {
            projectId: input.projectId,
            status: { in: ["new", "triaging", "in_progress"] },
          },
        }),
      ]);

      const stats = resolutionStats[0];
      const resolvedCount = Number(stats?.resolved_count || 0);
      const avgHours = stats?.avg_hours || 0;

      return {
        avgResolutionTimeHours: Math.round(avgHours),
        resolvedCount,
        pendingCount,
      };
    }),
});
