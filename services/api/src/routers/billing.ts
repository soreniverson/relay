import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure } from "../lib/trpc";
import {
  stripe,
  isStripeConfigured,
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  STRIPE_PRICES,
} from "../lib/stripe";
import {
  BILLING_PLANS,
  getPlanLimits,
  type BillingPlanKey,
} from "@relay/shared";

export const billingRouter = router({
  // Get current subscription and usage
  getSubscription: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Get or create subscription
      let subscription = await ctx.prisma.subscription.findUnique({
        where: { projectId: ctx.projectId },
      });

      // Create free subscription if none exists
      if (!subscription) {
        subscription = await ctx.prisma.subscription.create({
          data: {
            projectId: ctx.projectId,
            plan: "free",
            status: "active",
          },
        });
      }

      // Get current period usage
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let usageMetrics = await ctx.prisma.usageMetrics.findFirst({
        where: {
          projectId: ctx.projectId,
          periodStart: { gte: periodStart },
        },
        orderBy: { periodStart: "desc" },
      });

      // Create usage metrics if none exist for this period
      if (!usageMetrics) {
        usageMetrics = await ctx.prisma.usageMetrics.create({
          data: {
            projectId: ctx.projectId,
            periodStart,
            periodEnd,
          },
        });
      }

      // Get team member count
      const teamMemberCount = await ctx.prisma.projectMembership.count({
        where: { projectId: ctx.projectId },
      });

      const plan = subscription.plan as BillingPlanKey;
      const limits = getPlanLimits(plan);
      const planDetails = BILLING_PLANS[plan];

      return {
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          stripeCustomerId: subscription.stripeCustomerId,
        },
        usage: {
          interactions: usageMetrics.interactions,
          replays: usageMetrics.replays,
          storageBytes: Number(usageMetrics.storageBytes),
          teamMembers: teamMemberCount,
        },
        limits,
        planDetails: {
          name: planDetails.name,
          price: planDetails.price,
          priceYearly: planDetails.priceYearly,
          features: planDetails.features,
        },
        stripeConfigured: isStripeConfigured(),
      };
    }),

  // Create checkout session for upgrade
  createCheckoutSession: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        plan: z.enum(["pro"]),
        interval: z.enum(["monthly", "yearly"]).default("monthly"),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not configured",
        });
      }

      // Get or create subscription record
      let subscription = await ctx.prisma.subscription.findUnique({
        where: { projectId: ctx.projectId },
      });

      if (!subscription) {
        subscription = await ctx.prisma.subscription.create({
          data: {
            projectId: ctx.projectId,
            plan: "free",
            status: "active",
          },
        });
      }

      // Create Stripe customer if needed
      let customerId = subscription.stripeCustomerId;
      if (!customerId) {
        const customer = await createStripeCustomer({
          email: ctx.adminUser!.email,
          name: ctx.adminUser!.name || undefined,
          metadata: {
            projectId: ctx.projectId,
            adminUserId: ctx.adminUser!.id,
          },
        });

        if (!customer) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Stripe customer",
          });
        }

        customerId = customer.id;
        await ctx.prisma.subscription.update({
          where: { id: subscription.id },
          data: { stripeCustomerId: customerId },
        });
      }

      // Get price ID based on interval
      const priceId =
        input.interval === "yearly"
          ? STRIPE_PRICES.proYearly
          : STRIPE_PRICES.proMonthly;

      if (!priceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Price not configured",
        });
      }

      // Create checkout session
      const session = await createCheckoutSession({
        customerId,
        priceId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: {
          projectId: ctx.projectId,
          plan: input.plan,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),

  // Create portal session for subscription management
  createPortalSession: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        returnUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not configured",
        });
      }

      const subscription = await ctx.prisma.subscription.findUnique({
        where: { projectId: ctx.projectId },
      });

      if (!subscription?.stripeCustomerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No billing account found",
        });
      }

      const session = await createPortalSession({
        customerId: subscription.stripeCustomerId,
        returnUrl: input.returnUrl,
      });

      if (!session) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create portal session",
        });
      }

      return {
        url: session.url,
      };
    }),

  // Get invoice history
  getInvoices: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const invoices = await ctx.prisma.invoice.findMany({
        where: { projectId: ctx.projectId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return invoices.map((invoice) => ({
        id: invoice.id,
        amountDue: invoice.amountDue,
        amountPaid: invoice.amountPaid,
        currency: invoice.currency,
        status: invoice.status,
        invoiceUrl: invoice.invoiceUrl,
        invoicePdf: invoice.invoicePdf,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
      }));
    }),

  // Check if action is within plan limits
  checkLimit: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        metric: z.enum(["interactions", "replays", "storageGb", "teamMembers"]),
      }),
    )
    .query(async ({ input, ctx }) => {
      const subscription = await ctx.prisma.subscription.findUnique({
        where: { projectId: ctx.projectId },
      });

      const plan = (subscription?.plan || "free") as BillingPlanKey;
      const limits = getPlanLimits(plan);

      // Get current usage
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const usageMetrics = await ctx.prisma.usageMetrics.findFirst({
        where: {
          projectId: ctx.projectId,
          periodStart: { gte: periodStart },
        },
      });

      let currentUsage = 0;
      let limit = 0;

      switch (input.metric) {
        case "interactions":
          currentUsage = usageMetrics?.interactions || 0;
          limit = limits.interactions;
          break;
        case "replays":
          currentUsage = usageMetrics?.replays || 0;
          limit = limits.replays;
          break;
        case "storageGb":
          currentUsage =
            Number(usageMetrics?.storageBytes || 0) / (1024 * 1024 * 1024);
          limit = limits.storageGb;
          break;
        case "teamMembers":
          currentUsage = await ctx.prisma.projectMembership.count({
            where: { projectId: ctx.projectId },
          });
          limit = limits.teamMembers;
          break;
      }

      const withinLimit = currentUsage < limit;
      const percentage = Math.min(100, (currentUsage / limit) * 100);

      return {
        metric: input.metric,
        currentUsage,
        limit,
        withinLimit,
        percentage,
        plan,
      };
    }),
});
