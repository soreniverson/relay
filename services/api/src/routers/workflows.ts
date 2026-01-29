import { z } from "zod";
import { router, projectProcedure } from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

// Workflow trigger types
const triggerSchema = z.object({
  type: z.enum([
    "interaction.created",
    "interaction.updated",
    "conversation.created",
    "message.received",
    "survey.response",
    "schedule",
  ]),
  config: z.record(z.any()).optional(),
});

// Workflow condition schema
const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "greater_than",
    "less_than",
    "is_empty",
    "is_not_empty",
    "matches_regex",
  ]),
  value: z.any(),
});

// Workflow action schema
const actionSchema = z.object({
  type: z.enum([
    "send_email",
    "send_slack",
    "assign_to",
    "add_tag",
    "remove_tag",
    "set_status",
    "set_priority",
    "create_linear_issue",
    "create_jira_issue",
    "create_github_issue",
    "trigger_webhook",
    "ai_respond",
    "delay",
  ]),
  config: z.record(z.any()),
});

export const workflowsRouter = router({
  // ============================================================================
  // WORKFLOW CRUD
  // ============================================================================

  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        enabled: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const workflows = await ctx.prisma.workflow.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enabled !== undefined && { enabled: input.enabled }),
        },
        orderBy: { createdAt: "desc" },
      });

      return workflows;
    }),

  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.prisma.workflow.findUnique({
        where: { id: input.id },
        include: {
          runs: {
            orderBy: { startedAt: "desc" },
            take: 10,
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      return workflow;
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        trigger: triggerSchema,
        conditions: z.array(conditionSchema).optional(),
        actions: z.array(actionSchema).min(1),
        enabled: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.prisma.workflow.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          trigger: input.trigger as any,
          conditions: (input.conditions || []) as any,
          actions: input.actions as any,
          enabled: input.enabled,
        },
      });

      return workflow;
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        trigger: triggerSchema.optional(),
        conditions: z.array(conditionSchema).optional(),
        actions: z.array(actionSchema).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const workflow = await ctx.prisma.workflow.update({
        where: { id },
        data: {
          ...data,
          trigger: data.trigger as any,
          conditions: data.conditions as any,
          actions: data.actions as any,
        },
      });

      return workflow;
    }),

  delete: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workflow.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggle: projectProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.prisma.workflow.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });

      return workflow;
    }),

  // ============================================================================
  // WORKFLOW RUNS
  // ============================================================================

  listRuns: projectProcedure
    .input(
      z.object({
        workflowId: z.string(),
        status: z.enum(["running", "completed", "failed"]).optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.WorkflowRunWhereInput = {
        workflowId: input.workflowId,
        ...(input.status && { status: input.status }),
      };

      const [runs, total] = await Promise.all([
        ctx.prisma.workflowRun.findMany({
          where,
          orderBy: { startedAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.workflowRun.count({ where }),
      ]);

      return {
        runs,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  getRun: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.prisma.workflowRun.findUnique({
        where: { id: input.id },
        include: { workflow: true },
      });

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow run not found",
        });
      }

      return run;
    }),

  // ============================================================================
  // WORKFLOW TESTING
  // ============================================================================

  test: projectProcedure
    .input(
      z.object({
        workflowId: z.string(),
        testData: z.record(z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.prisma.workflow.findUnique({
        where: { id: input.workflowId },
      });

      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }

      // Simulate workflow execution
      const steps: {
        action: string;
        status: string;
        result: any;
        duration: number;
      }[] = [];
      const actions = workflow.actions as any[];

      for (const action of actions) {
        const startTime = Date.now();

        // Simulate action execution
        steps.push({
          action: action.type,
          status: "completed",
          result: { simulated: true },
          duration: Date.now() - startTime,
        });
      }

      return {
        success: true,
        steps,
        message: "Workflow test completed successfully (dry run)",
      };
    }),

  // ============================================================================
  // WORKFLOW TEMPLATES
  // ============================================================================

  getTemplates: projectProcedure.query(async () => {
    return [
      {
        id: "auto-assign-critical",
        name: "Auto-assign Critical Bugs",
        description:
          "Automatically assign critical bugs to the on-call engineer",
        trigger: { type: "interaction.created", config: {} },
        conditions: [
          { field: "type", operator: "equals", value: "bug" },
          { field: "severity", operator: "equals", value: "critical" },
        ],
        actions: [
          { type: "assign_to", config: { assigneeId: "$on_call" } },
          { type: "send_slack", config: { channel: "#critical-bugs" } },
        ],
      },
      {
        id: "welcome-message",
        name: "Welcome Message",
        description: "Send a welcome message when a new conversation starts",
        trigger: { type: "conversation.created", config: {} },
        conditions: [],
        actions: [{ type: "ai_respond", config: { useWelcomeMessage: true } }],
      },
      {
        id: "nps-followup",
        name: "NPS Detractor Follow-up",
        description: "Create a task when NPS score is low",
        trigger: { type: "survey.response", config: { surveyType: "nps" } },
        conditions: [{ field: "score", operator: "less_than", value: 7 }],
        actions: [
          { type: "add_tag", config: { tag: "detractor" } },
          { type: "send_slack", config: { channel: "#customer-success" } },
        ],
      },
      {
        id: "auto-close-resolved",
        name: "Auto-close Resolved Issues",
        description: "Close resolved issues after 7 days of inactivity",
        trigger: { type: "schedule", config: { cron: "0 0 * * *" } },
        conditions: [
          { field: "status", operator: "equals", value: "resolved" },
          { field: "updatedAt", operator: "less_than", value: "7d" },
        ],
        actions: [{ type: "set_status", config: { status: "closed" } }],
      },
    ];
  }),
});
