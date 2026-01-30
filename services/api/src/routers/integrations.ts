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
      const dashboardUrl =
        process.env.DASHBOARD_URL || "https://app.relay.dev";
      const relayUrl = `${dashboardUrl}/dashboard/inbox?id=${interaction.id}`;
      descriptionParts.push(`\n[View in Relay](${relayUrl})`);

      const description = descriptionParts.join("\n");

      // Create issue in Linear
      const linearClient = new LinearClient({ accessToken: config.accessToken });
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

      ctx.logger.info(
        { projectId: ctx.projectId },
        "Slack notification sent",
      );

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

      const linearClient = new LinearClient({ accessToken: config.accessToken });
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

      const linearClient = new LinearClient({ accessToken: config.accessToken });
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

      const linearClient = new LinearClient({ accessToken: config.accessToken });
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
      const linearClient = new LinearClient({ accessToken: config.accessToken });
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

  // Jira integration stub
  connectJira: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        siteUrl: z.string().url(),
        apiToken: z.string(),
        projectKey: z.string(),
      }),
    )
    .mutation(async ({ ctx }) => {
      // Check feature flag
      const enabled = await checkIntegrationEnabled(
        ctx.prisma,
        ctx.projectId,
        "jira",
      );
      if (!enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Jira integration is not yet available. Coming soon!",
        });
      }

      // TODO: Implement Jira integration
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Jira integration coming soon",
      });
    }),

  // GitHub integration stub
  connectGitHub: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        code: z.string(),
        redirectUri: z.string().url(),
      }),
    )
    .mutation(async ({ ctx }) => {
      // Check feature flag
      const enabled = await checkIntegrationEnabled(
        ctx.prisma,
        ctx.projectId,
        "github",
      );
      if (!enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "GitHub integration is not yet available. Coming soon!",
        });
      }

      // TODO: Implement GitHub integration
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "GitHub integration coming soon",
      });
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
