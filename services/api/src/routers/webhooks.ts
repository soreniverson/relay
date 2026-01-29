import { z } from 'zod';
import { router, projectProcedure } from '../lib/trpc';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

// Webhook event types
const webhookEventTypes = [
  'interaction.created',
  'interaction.updated',
  'interaction.resolved',
  'conversation.created',
  'conversation.closed',
  'message.received',
  'message.sent',
  'survey.response',
  'user.created',
  'user.updated',
  'feedback.received',
  'bug.reported',
] as const;

// Generate webhook secret
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

// Sign webhook payload
function signPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export const webhooksRouter = router({
  // ============================================================================
  // WEBHOOK CRUD
  // ============================================================================

  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        enabled: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const webhooks = await ctx.prisma.webhook.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enabled !== undefined && { enabled: input.enabled }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { deliveries: true },
          },
        },
      });

      // Mask secrets in response
      return webhooks.map((w) => ({
        ...w,
        secret: w.secret.slice(0, 12) + '...',
      }));
    }),

  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.findUnique({
        where: { id: input.id },
        include: {
          deliveries: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!webhook) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook not found' });
      }

      return {
        ...webhook,
        secret: webhook.secret.slice(0, 12) + '...',
      };
    }),

  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        url: z.string().url(),
        events: z.array(z.enum(webhookEventTypes)).min(1),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const secret = generateWebhookSecret();

      const webhook = await ctx.prisma.webhook.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          url: input.url,
          secret,
          events: input.events,
          enabled: input.enabled,
        },
      });

      // Return with full secret (only time it's visible)
      return webhook;
    }),

  update: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        url: z.string().url().optional(),
        events: z.array(z.enum(webhookEventTypes)).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const webhook = await ctx.prisma.webhook.update({
        where: { id },
        data,
      });

      return {
        ...webhook,
        secret: webhook.secret.slice(0, 12) + '...',
      };
    }),

  delete: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.webhook.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggle: projectProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });

      return {
        ...webhook,
        secret: webhook.secret.slice(0, 12) + '...',
      };
    }),

  // Regenerate webhook secret
  regenerateSecret: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const secret = generateWebhookSecret();

      const webhook = await ctx.prisma.webhook.update({
        where: { id: input.id },
        data: { secret },
      });

      // Return with full new secret
      return webhook;
    }),

  // ============================================================================
  // WEBHOOK DELIVERIES
  // ============================================================================

  listDeliveries: projectProcedure
    .input(
      z.object({
        webhookId: z.string(),
        statusCode: z.number().optional(), // Filter by HTTP status code
        page: z.number().default(1),
        pageSize: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.WebhookDeliveryWhereInput = {
        webhookId: input.webhookId,
        ...(input.statusCode !== undefined && { status: input.statusCode }),
      };

      const [deliveries, total] = await Promise.all([
        ctx.prisma.webhookDelivery.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.webhookDelivery.count({ where }),
      ]);

      return {
        deliveries,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  getDelivery: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const delivery = await ctx.prisma.webhookDelivery.findUnique({
        where: { id: input.id },
        include: { webhook: true },
      });

      if (!delivery) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found' });
      }

      return delivery;
    }),

  // Retry a failed delivery
  retryDelivery: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const delivery = await ctx.prisma.webhookDelivery.findUnique({
        where: { id: input.id },
        include: { webhook: true },
      });

      if (!delivery) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found' });
      }

      // Create new delivery attempt
      const payload = JSON.stringify(delivery.payload);
      const signature = signPayload(payload, delivery.webhook.secret);

      try {
        const startTime = Date.now();
        const response = await fetch(delivery.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
          },
          body: payload,
        });

        const duration = Date.now() - startTime;
        const responseBody = await response.text();

        // Update delivery with HTTP status code
        const updated = await ctx.prisma.webhookDelivery.update({
          where: { id: input.id },
          data: {
            status: response.status,
            response: responseBody.slice(0, 10000),
            duration,
            attempts: { increment: 1 },
          },
        });

        return updated;
      } catch (error) {
        const updated = await ctx.prisma.webhookDelivery.update({
          where: { id: input.id },
          data: {
            status: 0, // 0 indicates network error
            response: error instanceof Error ? error.message : 'Unknown error',
            attempts: { increment: 1 },
          },
        });

        return updated;
      }
    }),

  // ============================================================================
  // WEBHOOK TESTING
  // ============================================================================

  test: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.findUnique({
        where: { id: input.id },
      });

      if (!webhook) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook not found' });
      }

      // Create test payload
      const testPayload = {
        event: 'webhook.test',
        data: {
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString(),
        },
      };

      const payload = JSON.stringify(testPayload);
      const signature = signPayload(payload, webhook.secret);

      // Create delivery record (status null = pending)
      const delivery = await ctx.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event: 'webhook.test',
          payload: testPayload,
        },
      });

      try {
        const startTime = Date.now();
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
          },
          body: payload,
        });

        const duration = Date.now() - startTime;
        const responseBody = await response.text();

        // Update delivery with HTTP status code
        const updated = await ctx.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: response.status,
            response: responseBody.slice(0, 10000),
            duration,
          },
        });

        return {
          success: response.ok,
          delivery: updated,
        };
      } catch (error) {
        const updated = await ctx.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 0, // 0 indicates network error
            response: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        return {
          success: false,
          delivery: updated,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  // Get available event types
  getEventTypes: projectProcedure.query(() => {
    return webhookEventTypes.map((event) => ({
      value: event,
      label: event
        .split('.')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' '),
      category: event.split('.')[0],
    }));
  }),
});
