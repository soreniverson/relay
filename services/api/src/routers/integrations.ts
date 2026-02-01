import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure } from "../lib/trpc";
import {
  integrationProviderSchema,
  connectLinearSchema,
  connectSlackSchema,
  syncLinearIssueSchema,
} from "@relay/shared";
import {
  LinearClient,
  exchangeLinearOAuthCode,
  mapLinearStateToRelayStatus,
} from "../lib/linear";
import { SlackClient } from "../lib/slack";
import { JiraClient, mapJiraStatusToRelayStatus } from "../lib/jira";
import {
  GitHubClient,
  exchangeGitHubOAuthCode,
  mapGitHubStateToRelayStatus,
} from "../lib/github";
import { DiscordClient } from "../lib/discord";

// Feature flag check
async function checkIntegrationEnabled(
  prisma: any,
  projectId: string,
  provider: string,
): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: {
      projectId_flag: {
        projectId,
        flag: `integration_${provider}`,
      },
    },
  });
  return flag?.enabled ?? true; // Default to enabled for linear and slack
}

export const integrationsRouter = router({
  // List integrations
  list: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const integrations = await ctx.prisma.integration.findMany({
        where: { projectId: ctx.projectId },
      });

      // Add all available integrations (even if not configured)
      const allProviders = [
        "linear",
        "slack",
        "jira",
        "github",
        "discord",
        "email",
      ] as const;
      const result = allProviders.map((provider) => {
        const existing = integrations.find((i) => i.provider === provider);
        return {
          provider,
          enabled: existing?.enabled ?? false,
          configured: !!existing,
          lastSyncAt: existing?.lastSyncAt ?? null,
        };
      });

      return result;
    }),

  // Get integration details
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        provider: integrationProviderSchema,
      }),
    )
    .query(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: input.provider,
          },
        },
      });

      if (!integration) {
        return { provider: input.provider, configured: false, enabled: false };
      }

      // Mask sensitive config
      const config = integration.config as Record<string, unknown>;
      const safeConfig = { ...config };
      if ("accessToken" in safeConfig) safeConfig.accessToken = "***";
      if ("webhookUrl" in safeConfig) safeConfig.webhookUrl = "***";
      if ("apiToken" in safeConfig) safeConfig.apiToken = "***";

      return {
        provider: integration.provider,
        configured: true,
        enabled: integration.enabled,
        config: safeConfig,
        lastSyncAt: integration.lastSyncAt,
      };
    }),

  // Connect Linear
  connectLinear: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid() }).merge(connectLinearSchema),
    )
    .mutation(async ({ input, ctx }) => {
      // Exchange OAuth code for access token
      let accessToken: string;
      try {
        const tokenResponse = await exchangeLinearOAuthCode(
          input.code,
          input.redirectUri,
        );
        accessToken = tokenResponse.accessToken;
      } catch (error) {
        ctx.logger.error({ error }, "Linear OAuth exchange failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to exchange Linear OAuth code",
        });
      }

      // Verify the token works by fetching teams
      const linearClient = new LinearClient({ accessToken });
      let teams;
      try {
        teams = await linearClient.getTeams();
      } catch (error) {
        ctx.logger.error({ error }, "Failed to verify Linear token");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to verify Linear access token",
        });
      }

      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "linear",
          },
        },
        update: {
          enabled: true,
          config: {
            provider: "linear",
            accessToken,
            autoCreateIssues: false,
            teams: teams.map((t) => ({ id: t.id, name: t.name, key: t.key })),
          },
        },
        create: {
          projectId: ctx.projectId,
          provider: "linear",
          enabled: true,
          config: {
            provider: "linear",
            accessToken,
            autoCreateIssues: false,
            teams: teams.map((t) => ({ id: t.id, name: t.name, key: t.key })),
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.connected",
          targetType: "integration",
          targetId: integration.id,
          meta: { provider: "linear" },
        },
      });

      ctx.logger.info(
        { projectId: ctx.projectId, teamCount: teams.length },
        "Linear integration connected",
      );

      return { success: true, teams };
    }),

  // Connect Slack
  connectSlack: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }).merge(connectSlackSchema))
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "slack",
          },
        },
        update: {
          enabled: true,
          config: {
            provider: "slack",
            webhookUrl: input.webhookUrl,
            channelId: input.channelId,
            notifyOn: {
              newBug: true,
              highSeverity: true,
              newFeedback: true,
              newChat: true,
            },
          },
        },
        create: {
          projectId: ctx.projectId,
          provider: "slack",
          enabled: true,
          config: {
            provider: "slack",
            webhookUrl: input.webhookUrl,
            channelId: input.channelId,
            notifyOn: {
              newBug: true,
              highSeverity: true,
              newFeedback: true,
              newChat: true,
            },
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.connected",
          targetType: "integration",
          targetId: integration.id,
          meta: { provider: "slack" },
        },
      });

      return { success: true };
    }),

  // Disconnect integration
  disconnect: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        provider: integrationProviderSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: input.provider,
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      await ctx.prisma.integration.delete({
        where: { id: integration.id },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.disconnected",
          targetType: "integration",
          targetId: integration.id,
          meta: { provider: input.provider },
        },
      });

      return { success: true };
    }),

  // Toggle integration enabled
  toggle: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        provider: integrationProviderSchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.update({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: input.provider,
          },
        },
        data: { enabled: input.enabled },
      });

      return { success: true, enabled: integration.enabled };
    }),

  // Update integration config
  updateConfig: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        provider: integrationProviderSchema,
        config: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: input.provider,
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found",
        });
      }

      // Merge with existing config
      const existingConfig = integration.config as Record<string, unknown>;
      const newConfig = {
        ...existingConfig,
        ...input.config,
        provider: input.provider, // Ensure provider is always set
      };

      await ctx.prisma.integration.update({
        where: { id: integration.id },
        data: { config: newConfig },
      });

      return { success: true };
    }),

  // Sync issue to Linear
  syncLinearIssue: projectProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid(),
          teamId: z.string().optional(),
          labelIds: z.array(z.string()).optional(),
          priority: z.number().int().min(0).max(4).optional(),
        })
        .merge(syncLinearIssueSchema),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "linear",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear integration is not enabled",
        });
      }

      const config = integration.config as {
        accessToken?: string;
        teams?: Array<{ id: string; name: string; key: string }>;
      };

      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear access token not configured",
        });
      }

      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
        include: { user: true, media: true, session: true },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Determine team ID
      const teamId = input.teamId || config.teams?.[0]?.id;
      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Linear team specified and no default team available",
        });
      }

      // Build issue title and description
      const content = interaction.contentJson as Record<string, unknown> | null;
      const title =
        input.title ||
        (content?.title as string) ||
        interaction.contentText?.slice(0, 100) ||
        `Bug report from ${interaction.user?.email || "anonymous user"}`;

      const technicalContext = interaction.technicalContext as Record<
        string,
        unknown
      > | null;
      const descriptionParts: string[] = [];

      if (input.description || interaction.contentText) {
        descriptionParts.push(input.description || interaction.contentText!);
      }
      if (content?.description) {
        descriptionParts.push(content.description as string);
      }

      // Add technical context
      descriptionParts.push("\n---\n**Technical Details**");
      if (technicalContext?.url) {
        descriptionParts.push(`- **Page:** ${technicalContext.url}`);
      }
      if (interaction.user?.email) {
        descriptionParts.push(`- **User:** ${interaction.user.email}`);
      }
      if (interaction.severity) {
        descriptionParts.push(`- **Severity:** ${interaction.severity}`);
      }

      // Add Relay link
      const dashboardUrl = process.env.DASHBOARD_URL || "https://app.relay.dev";
      const relayUrl = `${dashboardUrl}/dashboard/inbox?id=${interaction.id}`;
      descriptionParts.push(`\n[View in Relay](${relayUrl})`);

      const description = descriptionParts.join("\n");

      // Create issue in Linear
      const linearClient = new LinearClient({
        accessToken: config.accessToken,
      });
      let issue;
      try {
        issue = await linearClient.createIssue({
          teamId,
          title,
          description,
          labelIds: input.labelIds,
          priority: input.priority,
        });
      } catch (error) {
        ctx.logger.error({ error }, "Failed to create Linear issue");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Linear issue",
        });
      }

      // Create integration link
      await ctx.prisma.integrationLink.create({
        data: {
          projectId: ctx.projectId,
          provider: "linear",
          externalId: issue.id,
          internalType: "interaction",
          internalId: input.interactionId,
          externalUrl: issue.url,
        },
      });

      // Update interaction with linked issue
      await ctx.prisma.interaction.update({
        where: { id: input.interactionId },
        data: {
          linkedIssueProvider: "linear",
          linkedIssueId: issue.identifier,
          linkedIssueUrl: issue.url,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.issue_synced",
          targetType: "interaction",
          targetId: input.interactionId,
          meta: {
            provider: "linear",
            issueId: issue.id,
            issueIdentifier: issue.identifier,
          },
        },
      });

      ctx.logger.info(
        {
          interactionId: input.interactionId,
          issueId: issue.id,
          issueIdentifier: issue.identifier,
        },
        "Issue created in Linear",
      );

      return {
        issueId: issue.identifier,
        issueUrl: issue.url,
      };
    }),

  // Send Slack notification
  sendSlackNotification: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        message: z.string().max(10000),
        interactionId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "slack",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Slack integration is not enabled",
        });
      }

      const config = integration.config as { webhookUrl?: string };

      if (!config.webhookUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Slack webhook URL not configured",
        });
      }

      const slackClient = new SlackClient({ webhookUrl: config.webhookUrl });

      try {
        await slackClient.sendText(input.message);
      } catch (error) {
        ctx.logger.error({ error }, "Failed to send Slack notification");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send Slack notification",
        });
      }

      ctx.logger.info({ projectId: ctx.projectId }, "Slack notification sent");

      return { success: true };
    }),

  // Get Linear teams
  getLinearTeams: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "linear",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear access token not configured",
        });
      }

      const linearClient = new LinearClient({
        accessToken: config.accessToken,
      });
      return await linearClient.getTeams();
    }),

  // Get Linear labels for a team
  getLinearLabels: projectProcedure
    .input(z.object({ projectId: z.string().uuid(), teamId: z.string() }))
    .query(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "linear",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear access token not configured",
        });
      }

      const linearClient = new LinearClient({
        accessToken: config.accessToken,
      });
      return await linearClient.getLabels(input.teamId);
    }),

  // Get Linear workflow states for a team
  getLinearWorkflowStates: projectProcedure
    .input(z.object({ projectId: z.string().uuid(), teamId: z.string() }))
    .query(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "linear",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear access token not configured",
        });
      }

      const linearClient = new LinearClient({
        accessToken: config.accessToken,
      });
      return await linearClient.getWorkflowStates(input.teamId);
    }),

  // Get linked issues for interaction
  getLinkedIssues: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const links = await ctx.prisma.integrationLink.findMany({
        where: {
          projectId: ctx.projectId,
          internalId: input.interactionId,
          internalType: "interaction",
        },
      });

      return links.map((link) => ({
        id: link.id,
        provider: link.provider,
        externalId: link.externalId,
        externalUrl: link.externalUrl,
        createdAt: link.createdAt,
      }));
    }),

  // Sync status from Linear (manual refresh)
  syncLinearStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "linear",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Linear access token not configured",
        });
      }

      // Find the integration link
      const link = await ctx.prisma.integrationLink.findFirst({
        where: {
          projectId: ctx.projectId,
          internalId: input.interactionId,
          internalType: "interaction",
          provider: "linear",
        },
      });

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No linked Linear issue found for this interaction",
        });
      }

      // Fetch current issue state from Linear
      const linearClient = new LinearClient({
        accessToken: config.accessToken,
      });
      const issue = await linearClient.getIssue(link.externalId);

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Linear issue not found - it may have been deleted",
        });
      }

      // Map Linear state to Relay status
      const newStatus = mapLinearStateToRelayStatus(issue.state.type);

      // Get current interaction
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Update interaction status if changed
      if (interaction.status !== newStatus) {
        await ctx.prisma.interaction.update({
          where: { id: input.interactionId },
          data: { status: newStatus },
        });

        ctx.logger.info(
          {
            interactionId: input.interactionId,
            oldStatus: interaction.status,
            newStatus,
            linearIssueId: issue.identifier,
          },
          "Interaction status synced from Linear (manual)",
        );
      }

      return {
        synced: interaction.status !== newStatus,
        previousStatus: interaction.status,
        currentStatus: newStatus,
        linearIssue: {
          identifier: issue.identifier,
          state: issue.state.name,
          url: issue.url,
        },
      };
    }),

  // Connect Jira
  connectJira: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        siteUrl: z.string().url(),
        email: z.string().email(),
        apiToken: z.string(),
        projectKey: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Verify credentials by testing connection
      const jiraClient = new JiraClient({
        siteUrl: input.siteUrl,
        email: input.email,
        apiToken: input.apiToken,
      });

      let user;
      try {
        user = await jiraClient.verifyConnection();
      } catch (error) {
        ctx.logger.error({ error }, "Jira connection verification failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to connect to Jira. Please verify your credentials.",
        });
      }

      // Get available projects
      let projects;
      try {
        projects = await jiraClient.getProjects();
      } catch (error) {
        ctx.logger.error({ error }, "Failed to fetch Jira projects");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to fetch Jira projects",
        });
      }

      // Verify the specified project exists
      const targetProject = projects.find((p) => p.key === input.projectKey);
      if (!targetProject) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Project with key "${input.projectKey}" not found or not accessible`,
        });
      }

      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "jira",
          },
        },
        update: {
          enabled: true,
          config: {
            provider: "jira",
            siteUrl: input.siteUrl,
            email: input.email,
            apiToken: input.apiToken,
            projectKey: input.projectKey,
            projectId: targetProject.id,
            projectName: targetProject.name,
            connectedUser: user,
            autoCreateIssues: false,
          },
        },
        create: {
          projectId: ctx.projectId,
          provider: "jira",
          enabled: true,
          config: {
            provider: "jira",
            siteUrl: input.siteUrl,
            email: input.email,
            apiToken: input.apiToken,
            projectKey: input.projectKey,
            projectId: targetProject.id,
            projectName: targetProject.name,
            connectedUser: user,
            autoCreateIssues: false,
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.connected",
          targetType: "integration",
          targetId: integration.id,
          meta: { provider: "jira", projectKey: input.projectKey },
        },
      });

      ctx.logger.info(
        {
          projectId: ctx.projectId,
          jiraProjectKey: input.projectKey,
        },
        "Jira integration connected",
      );

      return {
        success: true,
        project: {
          key: targetProject.key,
          name: targetProject.name,
        },
      };
    }),

  // Get Jira projects
  getJiraProjects: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "jira",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Jira integration is not enabled",
        });
      }

      const config = integration.config as {
        siteUrl: string;
        email: string;
        apiToken: string;
      };

      const jiraClient = new JiraClient(config);
      return await jiraClient.getProjects();
    }),

  // Get Jira issue types for a project
  getJiraIssueTypes: projectProcedure
    .input(z.object({ projectId: z.string().uuid(), jiraProjectKey: z.string() }))
    .query(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "jira",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Jira integration is not enabled",
        });
      }

      const config = integration.config as {
        siteUrl: string;
        email: string;
        apiToken: string;
      };

      const jiraClient = new JiraClient(config);
      return await jiraClient.getIssueTypes(input.jiraProjectKey);
    }),

  // Create Jira issue from interaction
  syncJiraIssue: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
        jiraProjectKey: z.string().optional(),
        issueTypeId: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.string().optional(),
        labels: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "jira",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Jira integration is not enabled",
        });
      }

      const config = integration.config as {
        siteUrl: string;
        email: string;
        apiToken: string;
        projectKey: string;
      };

      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
        include: { user: true },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Build issue content
      const content = interaction.contentJson as Record<string, unknown> | null;
      const title =
        input.title ||
        (content?.title as string) ||
        interaction.contentText?.slice(0, 100) ||
        `Bug report from ${interaction.user?.email || "anonymous user"}`;

      const technicalContext = interaction.technicalContext as Record<
        string,
        unknown
      > | null;
      const descriptionParts: string[] = [];

      if (input.description || interaction.contentText) {
        descriptionParts.push(input.description || interaction.contentText!);
      }
      if (content?.description) {
        descriptionParts.push(content.description as string);
      }

      // Add technical context
      descriptionParts.push("\n---\nTechnical Details:");
      if (technicalContext?.url) {
        descriptionParts.push(`Page: ${technicalContext.url}`);
      }
      if (interaction.user?.email) {
        descriptionParts.push(`User: ${interaction.user.email}`);
      }
      if (interaction.severity) {
        descriptionParts.push(`Severity: ${interaction.severity}`);
      }

      // Add Relay link
      const dashboardUrl = process.env.DASHBOARD_URL || "https://app.relay.dev";
      const relayUrl = `${dashboardUrl}/dashboard/inbox?id=${interaction.id}`;
      descriptionParts.push(`\nView in Relay: ${relayUrl}`);

      const description = descriptionParts.join("\n");

      // Create issue in Jira
      const jiraClient = new JiraClient(config);

      // Get default issue type if not specified
      let issueTypeId = input.issueTypeId;
      if (!issueTypeId) {
        const issueTypes = await jiraClient.getIssueTypes(input.jiraProjectKey || config.projectKey);
        const bugType = issueTypes.find((t) => t.name.toLowerCase() === "bug");
        const taskType = issueTypes.find((t) => t.name.toLowerCase() === "task");
        issueTypeId = bugType?.id || taskType?.id || issueTypes[0]?.id;

        if (!issueTypeId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No issue types available for this project",
          });
        }
      }

      let issue;
      try {
        issue = await jiraClient.createIssue({
          projectKey: input.jiraProjectKey || config.projectKey,
          issueTypeId,
          summary: title,
          description,
          priority: input.priority,
          labels: input.labels,
        });
      } catch (error) {
        ctx.logger.error({ error }, "Failed to create Jira issue");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Jira issue",
        });
      }

      const issueUrl = jiraClient.getIssueUrl(issue.key);

      // Create integration link
      await ctx.prisma.integrationLink.create({
        data: {
          projectId: ctx.projectId,
          provider: "jira",
          externalId: issue.id,
          internalType: "interaction",
          internalId: input.interactionId,
          externalUrl: issueUrl,
        },
      });

      // Update interaction with linked issue
      await ctx.prisma.interaction.update({
        where: { id: input.interactionId },
        data: {
          linkedIssueProvider: "jira",
          linkedIssueId: issue.key,
          linkedIssueUrl: issueUrl,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.issue_synced",
          targetType: "interaction",
          targetId: input.interactionId,
          meta: {
            provider: "jira",
            issueId: issue.id,
            issueKey: issue.key,
          },
        },
      });

      ctx.logger.info(
        {
          interactionId: input.interactionId,
          issueId: issue.id,
          issueKey: issue.key,
        },
        "Issue created in Jira",
      );

      return {
        issueId: issue.key,
        issueUrl,
      };
    }),

  // Sync status from Jira
  syncJiraStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "jira",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Jira integration is not enabled",
        });
      }

      const config = integration.config as {
        siteUrl: string;
        email: string;
        apiToken: string;
      };

      // Find the integration link
      const link = await ctx.prisma.integrationLink.findFirst({
        where: {
          projectId: ctx.projectId,
          internalId: input.interactionId,
          internalType: "interaction",
          provider: "jira",
        },
      });

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No linked Jira issue found for this interaction",
        });
      }

      // Fetch current issue state from Jira
      const jiraClient = new JiraClient(config);
      const issue = await jiraClient.getIssue(link.externalId);

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jira issue not found - it may have been deleted",
        });
      }

      // Map Jira status to Relay status
      const newStatus = mapJiraStatusToRelayStatus(
        issue.fields.status.statusCategory.key,
      );

      // Get current interaction
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Update interaction status if changed
      if (interaction.status !== newStatus) {
        await ctx.prisma.interaction.update({
          where: { id: input.interactionId },
          data: { status: newStatus },
        });

        ctx.logger.info(
          {
            interactionId: input.interactionId,
            oldStatus: interaction.status,
            newStatus,
            jiraIssueKey: issue.key,
          },
          "Interaction status synced from Jira",
        );
      }

      return {
        synced: interaction.status !== newStatus,
        previousStatus: interaction.status,
        currentStatus: newStatus,
        jiraIssue: {
          key: issue.key,
          status: issue.fields.status.name,
          url: jiraClient.getIssueUrl(issue.key),
        },
      };
    }),

  // Connect GitHub via OAuth
  connectGitHub: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        code: z.string(),
        redirectUri: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Exchange OAuth code for access token
      let tokenResponse;
      try {
        tokenResponse = await exchangeGitHubOAuthCode(input.code, input.redirectUri);
      } catch (error) {
        ctx.logger.error({ error }, "GitHub OAuth exchange failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to exchange GitHub OAuth code",
        });
      }

      // Verify the token works by fetching user info
      const githubClient = new GitHubClient({ accessToken: tokenResponse.accessToken });
      let user;
      let repos;
      try {
        user = await githubClient.getUser();
        repos = await githubClient.getRepositories({ per_page: 50 });
      } catch (error) {
        ctx.logger.error({ error }, "Failed to verify GitHub token");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to verify GitHub access token",
        });
      }

      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "github",
          },
        },
        update: {
          enabled: true,
          config: {
            provider: "github",
            accessToken: tokenResponse.accessToken,
            user: {
              login: user.login,
              name: user.name,
              avatar_url: user.avatar_url,
            },
            autoCreateIssues: false,
          },
        },
        create: {
          projectId: ctx.projectId,
          provider: "github",
          enabled: true,
          config: {
            provider: "github",
            accessToken: tokenResponse.accessToken,
            user: {
              login: user.login,
              name: user.name,
              avatar_url: user.avatar_url,
            },
            autoCreateIssues: false,
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.connected",
          targetType: "integration",
          targetId: integration.id,
          meta: { provider: "github", userLogin: user.login },
        },
      });

      ctx.logger.info(
        { projectId: ctx.projectId, userLogin: user.login },
        "GitHub integration connected",
      );

      return {
        success: true,
        user: {
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url,
        },
        repositories: repos.map((r) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          private: r.private,
        })),
      };
    }),

  // Get GitHub repositories
  getGitHubRepositories: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "github",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub access token not configured",
        });
      }

      const githubClient = new GitHubClient({ accessToken: config.accessToken });
      const repos = await githubClient.getRepositories({ per_page: 100 });

      return repos.map((r) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        owner: r.owner.login,
        private: r.private,
        description: r.description,
        html_url: r.html_url,
      }));
    }),

  // Get GitHub labels for a repository
  getGitHubLabels: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        owner: z.string(),
        repo: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "github",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub access token not configured",
        });
      }

      const githubClient = new GitHubClient({ accessToken: config.accessToken });
      return await githubClient.getLabels(input.owner, input.repo);
    }),

  // Create GitHub issue from interaction
  syncGitHubIssue: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
        owner: z.string(),
        repo: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "github",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub access token not configured",
        });
      }

      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
        include: { user: true },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Build issue content
      const content = interaction.contentJson as Record<string, unknown> | null;
      const title =
        input.title ||
        (content?.title as string) ||
        interaction.contentText?.slice(0, 100) ||
        `Bug report from ${interaction.user?.email || "anonymous user"}`;

      const technicalContext = interaction.technicalContext as Record<
        string,
        unknown
      > | null;
      const bodyParts: string[] = [];

      if (input.body || interaction.contentText) {
        bodyParts.push(input.body || interaction.contentText!);
      }
      if (content?.description) {
        bodyParts.push(content.description as string);
      }

      // Add technical context
      bodyParts.push("\n---\n### Technical Details");
      if (technicalContext?.url) {
        bodyParts.push(`- **Page:** ${technicalContext.url}`);
      }
      if (interaction.user?.email) {
        bodyParts.push(`- **User:** ${interaction.user.email}`);
      }
      if (interaction.severity) {
        bodyParts.push(`- **Severity:** ${interaction.severity}`);
      }

      // Add Relay link
      const dashboardUrl = process.env.DASHBOARD_URL || "https://app.relay.dev";
      const relayUrl = `${dashboardUrl}/dashboard/inbox?id=${interaction.id}`;
      bodyParts.push(`\n[View in Relay](${relayUrl})`);

      const body = bodyParts.join("\n");

      // Create issue in GitHub
      const githubClient = new GitHubClient({ accessToken: config.accessToken });
      let issue;
      try {
        issue = await githubClient.createIssue({
          owner: input.owner,
          repo: input.repo,
          title,
          body,
          labels: input.labels,
          assignees: input.assignees,
        });
      } catch (error) {
        ctx.logger.error({ error }, "Failed to create GitHub issue");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create GitHub issue",
        });
      }

      // Create integration link
      await ctx.prisma.integrationLink.create({
        data: {
          projectId: ctx.projectId,
          provider: "github",
          externalId: String(issue.id),
          internalType: "interaction",
          internalId: input.interactionId,
          externalUrl: issue.html_url,
        },
      });

      // Update interaction with linked issue
      await ctx.prisma.interaction.update({
        where: { id: input.interactionId },
        data: {
          linkedIssueProvider: "github",
          linkedIssueId: `${input.owner}/${input.repo}#${issue.number}`,
          linkedIssueUrl: issue.html_url,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.issue_synced",
          targetType: "interaction",
          targetId: input.interactionId,
          meta: {
            provider: "github",
            issueId: issue.id,
            issueNumber: issue.number,
            repo: `${input.owner}/${input.repo}`,
          },
        },
      });

      ctx.logger.info(
        {
          interactionId: input.interactionId,
          issueId: issue.id,
          issueNumber: issue.number,
        },
        "Issue created in GitHub",
      );

      return {
        issueId: `#${issue.number}`,
        issueUrl: issue.html_url,
      };
    }),

  // Sync status from GitHub
  syncGitHubStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "github",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub integration is not enabled",
        });
      }

      const config = integration.config as { accessToken?: string };
      if (!config.accessToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub access token not configured",
        });
      }

      // Find the integration link
      const link = await ctx.prisma.integrationLink.findFirst({
        where: {
          projectId: ctx.projectId,
          internalId: input.interactionId,
          internalType: "interaction",
          provider: "github",
        },
      });

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No linked GitHub issue found for this interaction",
        });
      }

      // Parse the external URL to get owner, repo, and issue number
      const urlMatch = link.externalUrl?.match(
        /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
      );
      if (!urlMatch) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid GitHub issue URL",
        });
      }

      const [, owner, repo, issueNumberStr] = urlMatch;
      const issueNumber = parseInt(issueNumberStr, 10);

      // Fetch current issue state from GitHub
      const githubClient = new GitHubClient({ accessToken: config.accessToken });
      const issue = await githubClient.getIssue(owner, repo, issueNumber);

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GitHub issue not found - it may have been deleted",
        });
      }

      // Map GitHub state to Relay status
      const newStatus = mapGitHubStateToRelayStatus(issue.state);

      // Get current interaction
      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId },
      });

      if (!interaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Interaction not found",
        });
      }

      // Update interaction status if changed
      if (interaction.status !== newStatus) {
        await ctx.prisma.interaction.update({
          where: { id: input.interactionId },
          data: { status: newStatus },
        });

        ctx.logger.info(
          {
            interactionId: input.interactionId,
            oldStatus: interaction.status,
            newStatus,
            githubIssueNumber: issue.number,
          },
          "Interaction status synced from GitHub",
        );
      }

      return {
        synced: interaction.status !== newStatus,
        previousStatus: interaction.status,
        currentStatus: newStatus,
        githubIssue: {
          number: issue.number,
          state: issue.state,
          url: issue.html_url,
        },
      };
    }),

  // Connect Discord webhook
  connectDiscord: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        webhookUrl: z.string().url(),
        notifyOn: z
          .object({
            newBug: z.boolean().optional(),
            highSeverity: z.boolean().optional(),
            newFeedback: z.boolean().optional(),
            newChat: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Test the webhook connection
      const discordClient = new DiscordClient({ webhookUrl: input.webhookUrl });

      try {
        const isValid = await discordClient.testConnection();
        if (!isValid) {
          throw new Error("Webhook test failed");
        }
      } catch (error) {
        ctx.logger.error({ error }, "Discord webhook test failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Failed to connect to Discord webhook. Please verify the webhook URL is correct.",
        });
      }

      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "discord",
          },
        },
        update: {
          enabled: true,
          config: {
            provider: "discord",
            webhookUrl: input.webhookUrl,
            notifyOn: input.notifyOn || {
              newBug: true,
              highSeverity: true,
              newFeedback: true,
              newChat: true,
            },
          },
        },
        create: {
          projectId: ctx.projectId,
          provider: "discord",
          enabled: true,
          config: {
            provider: "discord",
            webhookUrl: input.webhookUrl,
            notifyOn: input.notifyOn || {
              newBug: true,
              highSeverity: true,
              newFeedback: true,
              newChat: true,
            },
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: "admin",
          actorId: ctx.adminUser!.id,
          action: "integration.connected",
          targetType: "integration",
          targetId: integration.id,
          meta: { provider: "discord" },
        },
      });

      ctx.logger.info(
        { projectId: ctx.projectId },
        "Discord integration connected",
      );

      return { success: true };
    }),

  // Send Discord notification
  sendDiscordNotification: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        interactionId: z.string().uuid().optional(),
        type: z.enum(["bug", "feedback", "chat", "custom"]),
        message: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "discord",
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Discord integration is not enabled",
        });
      }

      const config = integration.config as { webhookUrl?: string };

      if (!config.webhookUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Discord webhook URL not configured",
        });
      }

      const discordClient = new DiscordClient({
        webhookUrl: config.webhookUrl,
      });

      // Build Relay URL
      const dashboardUrl = process.env.DASHBOARD_URL || "https://app.relay.dev";

      // If we have an interaction, send a rich notification
      if (input.interactionId) {
        const interaction = await ctx.prisma.interaction.findUnique({
          where: { id: input.interactionId, projectId: ctx.projectId },
          include: { user: true },
        });

        if (!interaction) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Interaction not found",
          });
        }

        const relayUrl = `${dashboardUrl}/dashboard/inbox?id=${interaction.id}`;
        const content =
          interaction.contentJson as Record<string, unknown> | null;

        try {
          if (input.type === "bug") {
            await discordClient.sendBugReport({
              title:
                (content?.title as string) ||
                interaction.contentText?.slice(0, 100) ||
                "Bug Report",
              description:
                (content?.description as string) ||
                interaction.contentText ||
                undefined,
              severity: interaction.severity || undefined,
              userEmail: interaction.user?.email || undefined,
              pageUrl:
                (interaction.technicalContext as Record<string, unknown>)
                  ?.url as string | undefined,
              relayUrl,
            });
          } else if (input.type === "feedback") {
            await discordClient.sendFeedback({
              title:
                (content?.title as string) ||
                interaction.contentText?.slice(0, 100) ||
                "Feedback",
              description:
                (content?.description as string) ||
                interaction.contentText ||
                undefined,
              category: (content?.category as string) || undefined,
              userEmail: interaction.user?.email || undefined,
              relayUrl,
            });
          } else if (input.type === "chat") {
            await discordClient.sendChatNotification({
              message:
                interaction.contentText?.slice(0, 500) || "New chat message",
              userEmail: interaction.user?.email || undefined,
              relayUrl,
            });
          } else if (input.type === "custom" && input.message) {
            await discordClient.sendText(input.message);
          }
        } catch (error) {
          ctx.logger.error({ error }, "Failed to send Discord notification");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send Discord notification",
          });
        }
      } else if (input.type === "custom" && input.message) {
        // Custom message without interaction
        try {
          await discordClient.sendText(input.message);
        } catch (error) {
          ctx.logger.error({ error }, "Failed to send Discord message");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send Discord message",
          });
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either interactionId or message must be provided",
        });
      }

      ctx.logger.info(
        {
          projectId: ctx.projectId,
          type: input.type,
          interactionId: input.interactionId,
        },
        "Discord notification sent",
      );

      return { success: true };
    }),

  // Update Discord notification settings
  updateDiscordSettings: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        notifyOn: z.object({
          newBug: z.boolean().optional(),
          highSeverity: z.boolean().optional(),
          newFeedback: z.boolean().optional(),
          newChat: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: "discord",
          },
        },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Discord integration not found",
        });
      }

      const existingConfig = integration.config as Record<string, unknown>;
      const newConfig = {
        ...existingConfig,
        notifyOn: {
          ...((existingConfig.notifyOn as Record<string, boolean>) || {}),
          ...input.notifyOn,
        },
      };

      await ctx.prisma.integration.update({
        where: { id: integration.id },
        data: { config: newConfig },
      });

      return { success: true };
    }),

  // Email integration stub
  configureEmail: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        notifyAddresses: z.array(z.string().email()).max(10),
        replyToAddress: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx }) => {
      // Check feature flag
      const enabled = await checkIntegrationEnabled(
        ctx.prisma,
        ctx.projectId,
        "email",
      );
      if (!enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Email integration is not yet available. Coming soon!",
        });
      }

      // TODO: Implement email integration
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Email integration coming soon",
      });
    }),
});
