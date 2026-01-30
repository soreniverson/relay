/**
 * Webhook Delivery Service
 * Handles outbound webhook delivery with retries, signatures, and logging.
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
  duration: number;
  error?: string;
}

// Retry delays in seconds: 1s, 10s, 60s
const RETRY_DELAYS = [1, 10, 60];
const TIMEOUT_MS = 10000;

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  const elements = signature.split(",");
  const timestamp = elements.find((e) => e.startsWith("t="))?.slice(2);
  const v1 = elements.find((e) => e.startsWith("v1="))?.slice(3);

  if (!timestamp || !v1) {
    return false;
  }

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > toleranceSeconds) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(v1),
    Buffer.from(expectedSignature),
  );
}

/**
 * Attempt to deliver a webhook
 */
async function attemptDelivery(
  url: string,
  payload: string,
  secret: string,
): Promise<DeliveryResult> {
  const signature = generateWebhookSignature(payload, secret);
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Signature": signature,
        "User-Agent": "Relay-Webhook/1.0",
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => null);

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody: responseBody?.slice(0, 10000) || null,
      duration,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    return {
      success: false,
      statusCode: null,
      responseBody: null,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Deliver a webhook with retries
 */
export async function deliverWebhook(
  prisma: PrismaClient,
  webhookId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Get webhook configuration
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook || !webhook.enabled) {
    return;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadString = JSON.stringify(payload);

  // Create delivery record
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event,
      payload: payload as any,
      attempts: 0,
    },
  });

  // Attempt delivery with retries
  let lastResult: DeliveryResult | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      // Wait before retry
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS[attempt - 1] * 1000),
      );
    }

    lastResult = await attemptDelivery(
      webhook.url,
      payloadString,
      webhook.secret,
    );

    // Update delivery record
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts: attempt + 1,
        status: lastResult.statusCode,
        response: lastResult.error || lastResult.responseBody,
        duration: lastResult.duration,
        nextRetryAt:
          !lastResult.success && attempt < RETRY_DELAYS.length
            ? new Date(Date.now() + RETRY_DELAYS[attempt] * 1000)
            : null,
      },
    });

    if (lastResult.success) {
      // Update webhook with last success
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          lastStatus: lastResult.statusCode,
          failureCount: 0,
        },
      });
      return;
    }
  }

  // All retries exhausted
  await prisma.webhook.update({
    where: { id: webhook.id },
    data: {
      lastTriggeredAt: new Date(),
      lastStatus: lastResult?.statusCode || 0,
      failureCount: { increment: 1 },
    },
  });
}

/**
 * Trigger webhooks for a specific event
 */
export async function triggerWebhooks(
  prisma: PrismaClient,
  projectId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Find all enabled webhooks that subscribe to this event
  const webhooks = await prisma.webhook.findMany({
    where: {
      projectId,
      enabled: true,
      events: { has: event },
    },
  });

  // Deliver to each webhook (in parallel)
  await Promise.allSettled(
    webhooks.map((webhook) => deliverWebhook(prisma, webhook.id, event, data)),
  );
}

/**
 * Webhook event types and their payloads
 */
export type WebhookEventType =
  | "interaction.created"
  | "interaction.updated"
  | "interaction.resolved"
  | "conversation.created"
  | "conversation.closed"
  | "message.received"
  | "message.sent"
  | "survey.response"
  | "user.created"
  | "user.updated"
  | "feedback.received"
  | "bug.reported";

export interface InteractionEventData {
  id: string;
  type: string;
  status: string;
  severity?: string;
  userId?: string;
  sessionId: string;
  contentText?: string;
  createdAt: string;
  url?: string;
}

export interface ConversationEventData {
  id: string;
  status: string;
  userId?: string;
  sessionId: string;
  subject?: string;
  messageCount: number;
  createdAt: string;
}

export interface MessageEventData {
  id: string;
  conversationId: string;
  direction: string;
  body: string;
  authorId?: string;
  createdAt: string;
}

export interface SurveyResponseEventData {
  id: string;
  surveyId: string;
  surveyName: string;
  sessionId: string;
  userId?: string;
  responses: Record<string, unknown>;
  createdAt: string;
}

export interface UserEventData {
  id: string;
  externalUserId?: string;
  email?: string;
  name?: string;
  traits: Record<string, unknown>;
  createdAt: string;
}
