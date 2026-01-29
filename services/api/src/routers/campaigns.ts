import { z } from 'zod';
import { router, projectProcedure } from '../lib/trpc';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

export const campaignsRouter = router({
  // ============================================================================
  // CAMPAIGN CRUD
  // ============================================================================

  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const campaigns = await ctx.prisma.emailCampaign.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status && { status: input.status }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { sends: true },
          },
        },
      });

      return campaigns;
    }),

  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
        include: {
          sends: {
            take: 100,
            orderBy: { sentAt: 'desc' },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      return campaign;
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        subject: z.string().min(1),
        previewText: z.string().optional(),
        content: z.string().min(1),
        fromName: z.string().optional(),
        fromEmail: z.string().email().optional(),
        replyTo: z.string().email().optional(),
        segmentRules: z.record(z.any()).optional(),
        scheduledAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          subject: input.subject,
          previewText: input.previewText,
          content: input.content,
          fromName: input.fromName,
          fromEmail: input.fromEmail,
          replyTo: input.replyTo,
          segmentRules: input.segmentRules as Prisma.JsonObject | undefined,
          scheduledAt: input.scheduledAt,
          status: input.scheduledAt ? 'scheduled' : 'draft',
        },
      });

      return campaign;
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        previewText: z.string().optional(),
        content: z.string().optional(),
        fromName: z.string().optional(),
        fromEmail: z.string().email().optional(),
        replyTo: z.string().email().optional(),
        segmentRules: z.record(z.any()).optional(),
        scheduledAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check if campaign can be edited
      const existing = await ctx.prisma.emailCampaign.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      if (existing.status === 'sending' || existing.status === 'sent') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot edit a campaign that is sending or has been sent',
        });
      }

      const campaign = await ctx.prisma.emailCampaign.update({
        where: { id },
        data: {
          ...data,
          segmentRules: data.segmentRules as Prisma.JsonObject | undefined,
          status: data.scheduledAt ? 'scheduled' : existing.status,
        },
      });

      return campaign;
    }),

  delete: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      if (existing.status === 'sending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete a campaign that is currently sending',
        });
      }

      await ctx.prisma.emailCampaign.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ============================================================================
  // CAMPAIGN ACTIONS
  // ============================================================================

  // Schedule a campaign
  schedule: projectProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      if (campaign.status !== 'draft') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft campaigns can be scheduled',
        });
      }

      if (input.scheduledAt <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Scheduled time must be in the future',
        });
      }

      const updated = await ctx.prisma.emailCampaign.update({
        where: { id: input.id },
        data: {
          scheduledAt: input.scheduledAt,
          status: 'scheduled',
        },
      });

      return updated;
    }),

  // Send campaign immediately
  send: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Campaign has already been sent or is currently sending',
        });
      }

      // Start sending (in production, queue this)
      await ctx.prisma.emailCampaign.update({
        where: { id: input.id },
        data: {
          status: 'sending',
          sentAt: new Date(),
        },
      });

      // Get target users based on segment rules
      const segmentRules = campaign.segmentRules as Record<string, unknown> | null;
      const where: Prisma.EndUserWhereInput = {
        projectId: campaign.projectId,
        email: { not: null },
      };

      // Apply segment rules if defined
      if (segmentRules?.tags && Array.isArray(segmentRules.tags)) {
        // This would need custom logic based on traits
      }

      const users = await ctx.prisma.endUser.findMany({
        where,
        select: { id: true, email: true, name: true },
      });

      // Create send records (in production, actually send emails via SendGrid/Postmark/SES)
      const sends = await Promise.all(
        users.filter((u) => u.email).map(async (user) => {
          // In production, send via email provider here
          return ctx.prisma.emailSend.create({
            data: {
              campaignId: campaign.id,
              userId: user.id,
              email: user.email!,
              status: 'sent', // Simulated
              sentAt: new Date(),
            },
          });
        })
      );

      // Mark campaign as sent
      await ctx.prisma.emailCampaign.update({
        where: { id: input.id },
        data: {
          status: 'sent',
          recipientCount: sends.length,
          sentCount: sends.length,
        },
      });

      return {
        success: true,
        recipientCount: sends.length,
      };
    }),

  // Cancel a scheduled campaign
  cancel: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      if (campaign.status !== 'scheduled') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only scheduled campaigns can be cancelled',
        });
      }

      const updated = await ctx.prisma.emailCampaign.update({
        where: { id: input.id },
        data: {
          status: 'cancelled',
          scheduledAt: null,
        },
      });

      return updated;
    }),

  // Duplicate a campaign
  duplicate: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const duplicate = await ctx.prisma.emailCampaign.create({
        data: {
          projectId: original.projectId,
          name: `${original.name} (Copy)`,
          subject: original.subject,
          previewText: original.previewText,
          content: original.content,
          contentHtml: original.contentHtml,
          fromName: original.fromName,
          fromEmail: original.fromEmail,
          replyTo: original.replyTo,
          segmentRules: original.segmentRules as Prisma.JsonObject | undefined,
          status: 'draft',
        },
      });

      return duplicate;
    }),

  // ============================================================================
  // CAMPAIGN ANALYTICS
  // ============================================================================

  getAnalytics: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.emailCampaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }

      const [sends, opened, clicked, bounced, unsubscribed] = await Promise.all([
        ctx.prisma.emailSend.count({ where: { campaignId: input.id } }),
        ctx.prisma.emailSend.count({ where: { campaignId: input.id, openedAt: { not: null } } }),
        ctx.prisma.emailSend.count({ where: { campaignId: input.id, clickedAt: { not: null } } }),
        ctx.prisma.emailSend.count({ where: { campaignId: input.id, bouncedAt: { not: null } } }),
        ctx.prisma.emailSend.count({ where: { campaignId: input.id, unsubAt: { not: null } } }),
      ]);

      const delivered = sends - bounced;

      return {
        sent: sends,
        delivered,
        opened,
        clicked,
        bounced,
        unsubscribed,
        deliveryRate: sends > 0 ? (delivered / sends) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
        bounceRate: sends > 0 ? (bounced / sends) * 100 : 0,
        unsubscribeRate: delivered > 0 ? (unsubscribed / delivered) * 100 : 0,
      };
    }),

  // Get send activity (for charts)
  getSendActivity: projectProcedure
    .input(
      z.object({
        id: z.string(),
        metric: z.enum(['opens', 'clicks']),
      })
    )
    .query(async ({ ctx, input }) => {
      const sends = await ctx.prisma.emailSend.findMany({
        where: {
          campaignId: input.id,
          ...(input.metric === 'opens'
            ? { openedAt: { not: null } }
            : { clickedAt: { not: null } }),
        },
        select: {
          openedAt: true,
          clickedAt: true,
        },
      });

      // Group by hour
      const hourlyData = new Map<string, number>();
      sends.forEach((send) => {
        const date = input.metric === 'opens' ? send.openedAt : send.clickedAt;
        if (date) {
          const hour = new Date(date).toISOString().slice(0, 13);
          hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1);
        }
      });

      return Array.from(hourlyData.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));
    }),

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  getTemplates: projectProcedure.query(async () => {
    return [
      {
        id: 'welcome',
        name: 'Welcome Email',
        description: 'Welcome new users to your product',
        subject: 'Welcome to {{product_name}}, {{name}}!',
        previewText: "We're excited to have you on board",
        content: `
# Welcome, {{name}}!

We're thrilled to have you join us.

Here are some things you can do to get started:
- Complete your profile
- Explore our features
- Join our community

[Get Started]({{cta_url}})
        `.trim(),
      },
      {
        id: 'product-update',
        name: 'Product Update',
        description: 'Announce new features or updates',
        subject: 'New in {{product_name}}: {{feature_name}}',
        previewText: "Check out what's new",
        content: `
# Introducing {{feature_name}}

We've been working hard to bring you something special.

{{feature_description}}

[Learn More]({{cta_url}})
        `.trim(),
      },
      {
        id: 'feedback-request',
        name: 'Feedback Request',
        description: 'Ask users for feedback',
        subject: "We'd love your feedback, {{name}}",
        previewText: 'Your opinion matters to us',
        content: `
# How are we doing?

Hi {{name}},

We'd love to hear what you think about {{product_name}}.

Your feedback helps us improve and build features you'll love.

[Share Your Thoughts]({{survey_url}})
        `.trim(),
      },
      {
        id: 're-engagement',
        name: 'Re-engagement',
        description: 'Win back inactive users',
        subject: 'We miss you, {{name}}!',
        previewText: "Come see what you've been missing",
        content: `
# It's been a while!

Hi {{name}},

We noticed you haven't logged in recently. Here's what's new since you've been away:

- {{update_1}}
- {{update_2}}
- {{update_3}}

[Check It Out]({{cta_url}})
        `.trim(),
      },
    ];
  }),

  // Preview email with sample data
  previewTemplate: projectProcedure
    .input(
      z.object({
        subject: z.string(),
        content: z.string(),
        sampleData: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { sampleData = {} } = input;

      // Default sample data
      const data: Record<string, string> = {
        name: 'John',
        email: 'john@example.com',
        product_name: 'Your Product',
        ...sampleData,
      };

      // Replace placeholders
      let subject = input.subject;
      let content = input.content;

      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value);
        content = content.replace(regex, value);
      }

      return {
        subject,
        content,
      };
    }),
});
