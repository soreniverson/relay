import Stripe from "stripe";
import { logger } from "./logger";

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    })
  : null;

// Log warning if Stripe is not configured
if (!stripe) {
  logger.warn("Stripe is not configured - billing features will be disabled");
}

// Price IDs from environment
export const STRIPE_PRICES = {
  proMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
  proYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
};

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export function isStripeConfigured(): boolean {
  return stripe !== null && STRIPE_PRICES.proMonthly !== "";
}

// Helper to create a Stripe customer
export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer | null> {
  if (!stripe) return null;

  try {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
    return customer;
  } catch (error) {
    logger.error({ error }, "Failed to create Stripe customer");
    throw error;
  }
}

// Helper to create a checkout session
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      subscription_data: {
        metadata: params.metadata,
      },
    });
    return session;
  } catch (error) {
    logger.error({ error }, "Failed to create checkout session");
    throw error;
  }
}

// Helper to create a billing portal session
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session | null> {
  if (!stripe) return null;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    return session;
  } catch (error) {
    logger.error({ error }, "Failed to create portal session");
    throw error;
  }
}

// Helper to cancel a subscription
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true,
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;

  try {
    if (cancelAtPeriodEnd) {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch (error) {
    logger.error({ error }, "Failed to cancel subscription");
    throw error;
  }
}

// Helper to get subscription
export async function getSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    logger.error({ error }, "Failed to retrieve subscription");
    throw error;
  }
}

// Helper to list invoices for a customer
export async function listInvoices(
  customerId: string,
  limit: number = 10,
): Promise<Stripe.Invoice[]> {
  if (!stripe) return [];

  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  } catch (error) {
    logger.error({ error }, "Failed to list invoices");
    throw error;
  }
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event | null {
  if (!stripe) return null;

  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    logger.error({ error }, "Failed to verify webhook signature");
    return null;
  }
}
