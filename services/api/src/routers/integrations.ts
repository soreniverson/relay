import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, projectProcedure } from '../lib/trpc';
import { integrationProviderSchema, connectLinearSchema, connectSlackSchema, syncLinearIssueSchema } from '@relay/shared';

// Feature flag check
async function checkIntegrationEnabled(
  prisma: any,
  projectId: string,
  provider: string
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
      const allProviders = ['linear', 'slack', 'jira', 'github', 'email'] as const;
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
    .input(z.object({ projectId: z.string().uuid(), provider: integrationProviderSchema }))
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
      if ('accessToken' in safeConfig) safeConfig.accessToken = '***';
      if ('webhookUrl' in safeConfig) safeConfig.webhookUrl = '***';
      if ('apiToken' in safeConfig) safeConfig.apiToken = '***';

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
    .input(z.object({ projectId: z.string().uuid() }).merge(connectLinearSchema))
    .mutation(async ({ input, ctx }) => {
      // In production, exchange OAuth code for access token
      // For now, simulate OAuth flow
      // const tokenResponse = await exchangeLinearCode(input.code, input.redirectUri);

      // TODO: Implement real OAuth exchange
      ctx.logger.info('Linear OAuth code exchange would happen here');

      // For demo purposes, create a placeholder integration
      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: 'linear',
          },
        },
        update: {
          enabled: true,
          config: {
            provider: 'linear',
            // accessToken would be stored encrypted in production
            accessToken: 'placeholder_token',
            autoCreateIssues: false,
          },
        },
        create: {
          projectId: ctx.projectId,
          provider: 'linear',
          enabled: true,
          config: {
            provider: 'linear',
            accessToken: 'placeholder_token',
            autoCreateIssues: false,
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: 'admin',
          actorId: ctx.adminUser!.id,
          action: 'integration.connected',
          targetType: 'integration',
          targetId: integration.id,
          meta: { provider: 'linear' },
        },
      });

      return { success: true };
    }),

  // Connect Slack
  connectSlack: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }).merge(connectSlackSchema))
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: 'slack',
          },
        },
        update: {
          enabled: true,
          config: {
            provider: 'slack',
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
          provider: 'slack',
          enabled: true,
          config: {
            provider: 'slack',
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
          actorType: 'admin',
          actorId: ctx.adminUser!.id,
          action: 'integration.connected',
          targetType: 'integration',
          targetId: integration.id,
          meta: { provider: 'slack' },
        },
      });

      return { success: true };
    }),

  // Disconnect integration
  disconnect: projectProcedure
    .input(z.object({ projectId: z.string().uuid(), provider: integrationProviderSchema }))
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
          code: 'NOT_FOUND',
          message: 'Integration not found',
        });
      }

      await ctx.prisma.integration.delete({
        where: { id: integration.id },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: 'admin',
          actorId: ctx.adminUser!.id,
          action: 'integration.disconnected',
          targetType: 'integration',
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
      })
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
      })
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
          code: 'NOT_FOUND',
          message: 'Integration not found',
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
    .input(z.object({ projectId: z.string().uuid() }).merge(syncLinearIssueSchema))
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: 'linear',
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Linear integration is not enabled',
        });
      }

      const interaction = await ctx.prisma.interaction.findUnique({
        where: { id: input.interactionId, projectId: ctx.projectId },
        include: { user: true, media: true },
      });

      if (!interaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Interaction not found',
        });
      }

      // TODO: Implement actual Linear API call
      // const linearClient = new LinearClient({ accessToken: config.accessToken });
      // const issue = await linearClient.createIssue({ ... });

      // For now, create a mock link
      const mockIssueId = `LIN-${Date.now()}`;
      const mockIssueUrl = `https://linear.app/team/issue/${mockIssueId}`;

      // Create integration link
      await ctx.prisma.integrationLink.create({
        data: {
          projectId: ctx.projectId,
          provider: 'linear',
          externalId: mockIssueId,
          internalType: 'interaction',
          internalId: input.interactionId,
          externalUrl: mockIssueUrl,
        },
      });

      // Update interaction with linked issue
      await ctx.prisma.interaction.update({
        where: { id: input.interactionId },
        data: {
          linkedIssueProvider: 'linear',
          linkedIssueId: mockIssueId,
          linkedIssueUrl: mockIssueUrl,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          projectId: ctx.projectId,
          actorType: 'admin',
          actorId: ctx.adminUser!.id,
          action: 'integration.issue_synced',
          targetType: 'interaction',
          targetId: input.interactionId,
          meta: { provider: 'linear', issueId: mockIssueId },
        },
      });

      ctx.logger.info({ interactionId: input.interactionId, issueId: mockIssueId }, 'Issue synced to Linear');

      return {
        issueId: mockIssueId,
        issueUrl: mockIssueUrl,
      };
    }),

  // Send Slack notification
  sendSlackNotification: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        message: z.string().max(10000),
        interactionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const integration = await ctx.prisma.integration.findUnique({
        where: {
          projectId_provider: {
            projectId: ctx.projectId,
            provider: 'slack',
          },
        },
      });

      if (!integration || !integration.enabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Slack integration is not enabled',
        });
      }

      const config = integration.config as { webhookUrl?: string };

      if (!config.webhookUrl) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Slack webhook URL not configured',
        });
      }

      // TODO: Implement actual Slack webhook call
      // await fetch(config.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ text: input.message }),
      // });

      ctx.logger.info({ projectId: ctx.projectId }, 'Slack notification would be sent');

      return { success: true };
    }),

  // Get linked issues for interaction
  getLinkedIssues: projectProcedure
    .input(z.object({ projectId: z.string().uuid(), interactionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const links = await ctx.prisma.integrationLink.findMany({
        where: {
          projectId: ctx.projectId,
          internalId: input.interactionId,
          internalType: 'interaction',
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

  // Jira integration stub
  connectJira: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        siteUrl: z.string().url(),
        apiToken: z.string(),
        projectKey: z.string(),
      })
    )
    .mutation(async ({ ctx }) => {
      // Check feature flag
      const enabled = await checkIntegrationEnabled(ctx.prisma, ctx.projectId, 'jira');
      if (!enabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Jira integration is not yet available. Coming soon!',
        });
      }

      // TODO: Implement Jira integration
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Jira integration coming soon',
      });
    }),

  // GitHub integration stub
  connectGitHub: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        code: z.string(),
        redirectUri: z.string().url(),
      })
    )
    .mutation(async ({ ctx }) => {
      // Check feature flag
      const enabled = await checkIntegrationEnabled(ctx.prisma, ctx.projectId, 'github');
      if (!enabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'GitHub integration is not yet available. Coming soon!',
        });
      }

      // TODO: Implement GitHub integration
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'GitHub integration coming soon',
      });
    }),

  // Email integration stub
  configureEmail: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        notifyAddresses: z.array(z.string().email()).max(10),
        replyToAddress: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx }) => {
      // Check feature flag
      const enabled = await checkIntegrationEnabled(ctx.prisma, ctx.projectId, 'email');
      if (!enabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Email integration is not yet available. Coming soon!',
        });
      }

      // TODO: Implement email integration
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Email integration coming soon',
      });
    }),
});
