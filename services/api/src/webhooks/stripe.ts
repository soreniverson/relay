import type { Request, Response } from "express";
import type Stripe from "stripe";
import { constructWebhookEvent } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export async function handleStripeWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const event = constructWebhookEvent(req.body, signature);

  if (!event) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  logger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.debug({ eventType: event.type }, "Unhandled Stripe event");
    }

    res.json({ received: true });
  } catch (error) {
    logger.error({ error, eventType: event.type }, "Error handling Stripe webhook");
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const projectId = session.metadata?.projectId;
  if (!projectId) {
    logger.warn("Checkout session missing projectId metadata");
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  logger.info(
    { projectId, subscriptionId, customerId },
    "Checkout completed, activating subscription"
  );

  await prisma.subscription.update({
    where: { projectId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan: "pro",
      status: "active",
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      projectId,
      actorType: "system",
      actorId: "stripe",
      action: "subscription.upgraded",
      targetType: "subscription",
      targetId: projectId,
      meta: { plan: "pro", subscriptionId },
    },
  });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const projectId = subscription.metadata?.projectId;

  // Find subscription by Stripe subscription ID if metadata is missing
  const existingSub = projectId
    ? await prisma.subscription.findUnique({ where: { projectId } })
    : await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });

  if (!existingSub) {
    logger.warn(
      { subscriptionId: subscription.id },
      "No matching subscription found for update"
    );
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "incomplete",
    trialing: "trialing",
    unpaid: "past_due",
    incomplete_expired: "canceled",
  };

  const status = statusMap[subscription.status] || "active";

  // Get period info from subscription items if available
  const periodStart = (subscription as unknown as { current_period_start?: number }).current_period_start;
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  await prisma.subscription.update({
    where: { id: existingSub.id },
    data: {
      status: status as "active" | "past_due" | "canceled" | "incomplete" | "trialing",
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    },
  });

  logger.info(
    { projectId: existingSub.projectId, status },
    "Subscription updated"
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const existingSub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSub) {
    logger.warn(
      { subscriptionId: subscription.id },
      "No matching subscription found for deletion"
    );
    return;
  }

  // Downgrade to free plan
  await prisma.subscription.update({
    where: { id: existingSub.id },
    data: {
      plan: "free",
      status: "active",
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      projectId: existingSub.projectId,
      actorType: "system",
      actorId: "stripe",
      action: "subscription.downgraded",
      targetType: "subscription",
      targetId: existingSub.projectId,
      meta: { fromPlan: existingSub.plan, toPlan: "free" },
    },
  });

  logger.info(
    { projectId: existingSub.projectId },
    "Subscription canceled, downgraded to free"
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  // Find subscription by customer ID
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!subscription) {
    logger.warn({ customerId }, "No subscription found for invoice");
    return;
  }

  // Create or update invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: {
      amountPaid: invoice.amount_paid,
      status: "paid",
      paidAt: new Date(),
    },
    create: {
      projectId: subscription.projectId,
      stripeInvoiceId: invoice.id,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: "paid",
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
      paidAt: new Date(),
    },
  });

  // Reset usage metrics for the new billing period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.usageMetrics.upsert({
    where: {
      projectId_periodStart: {
        projectId: subscription.projectId,
        periodStart,
      },
    },
    update: {}, // No update needed, just ensure it exists
    create: {
      projectId: subscription.projectId,
      periodStart,
      periodEnd,
      interactions: 0,
      replays: 0,
      storageBytes: 0,
    },
  });

  logger.info(
    { projectId: subscription.projectId, invoiceId: invoice.id },
    "Invoice paid"
  );
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!subscription) {
    logger.warn({ customerId }, "No subscription found for failed invoice");
    return;
  }

  // Update subscription status to past_due
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "past_due" },
  });

  // Create invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: {
      status: "open",
    },
    create: {
      projectId: subscription.projectId,
      stripeInvoiceId: invoice.id,
      amountDue: invoice.amount_due,
      amountPaid: 0,
      currency: invoice.currency,
      status: "open",
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      projectId: subscription.projectId,
      actorType: "system",
      actorId: "stripe",
      action: "payment.failed",
      targetType: "subscription",
      targetId: subscription.projectId,
      meta: { invoiceId: invoice.id },
    },
  });

  logger.warn(
    { projectId: subscription.projectId, invoiceId: invoice.id },
    "Invoice payment failed"
  );
}
