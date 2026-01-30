/**
 * Linear Webhook Handler
 * Handles incoming webhooks from Linear for bidirectional status sync.
 */

import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { mapLinearStateToRelayStatus } from "../lib/linear";

interface LinearWebhookPayload {
  action: string;
  type: string;
  data: {
    id: string;
    identifier?: string;
    state?: {
      id: string;
      name: string;
      type: string;
    };
    title?: string;
    description?: string;
    url?: string;
  };
  organizationId: string;
  createdAt: string;
}

/**
 * Verify Linear webhook signature
 */
function verifyLinearSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expectedSignature = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

/**
 * Handle Linear webhook events
 */
export async function handleLinearWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.headers["linear-signature"] as string;
  const rawBody = JSON.stringify(req.body);

  // Log incoming webhook
  logger.info(
    { headers: req.headers, body: req.body },
    "Linear webhook received",
  );

  // For now, skip signature verification if no secret is configured
  // In production, you'd want to verify the signature
  const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    const isValid = verifyLinearSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      logger.warn("Invalid Linear webhook signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  try {
    const payload = req.body as LinearWebhookPayload;

    // Handle different event types
    if (payload.type === "Issue" && payload.action === "update") {
      await handleIssueUpdate(payload);
    } else if (payload.type === "Issue" && payload.action === "remove") {
      await handleIssueRemove(payload);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error }, "Error processing Linear webhook");
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Handle Linear issue update - sync status to Relay
 */
async function handleIssueUpdate(payload: LinearWebhookPayload): Promise<void> {
  const { data } = payload;
  const linearIssueId = data.id;
  const newState = data.state;

  if (!newState) {
    logger.debug({ linearIssueId }, "No state change in webhook");
    return;
  }

  // Find the integration link by Linear issue ID
  const link = await prisma.integrationLink.findFirst({
    where: {
      provider: "linear",
      externalId: linearIssueId,
      internalType: "interaction",
    },
  });

  if (!link) {
    logger.debug(
      { linearIssueId },
      "No linked interaction found for Linear issue",
    );
    return;
  }

  // Map Linear state to Relay status
  const newRelayStatus = mapLinearStateToRelayStatus(newState.type);

  // Update the interaction status
  const interaction = await prisma.interaction.findUnique({
    where: { id: link.internalId },
  });

  if (!interaction) {
    logger.warn(
      { interactionId: link.internalId },
      "Linked interaction not found",
    );
    return;
  }

  // Only update if status actually changed
  if (interaction.status !== newRelayStatus) {
    await prisma.interaction.update({
      where: { id: link.internalId },
      data: { status: newRelayStatus },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        projectId: interaction.projectId,
        actorType: "system",
        actorId: "linear-webhook",
        action: "interaction.status_synced",
        targetType: "interaction",
        targetId: interaction.id,
        meta: {
          provider: "linear",
          linearIssueId: data.identifier || linearIssueId,
          oldStatus: interaction.status,
          newStatus: newRelayStatus,
          linearState: newState.name,
        },
      },
    });

    logger.info(
      {
        interactionId: interaction.id,
        linearIssueId: data.identifier,
        oldStatus: interaction.status,
        newStatus: newRelayStatus,
      },
      "Interaction status synced from Linear",
    );
  }
}

/**
 * Handle Linear issue removal
 */
async function handleIssueRemove(payload: LinearWebhookPayload): Promise<void> {
  const linearIssueId = payload.data.id;

  // Find and remove the integration link
  const link = await prisma.integrationLink.findFirst({
    where: {
      provider: "linear",
      externalId: linearIssueId,
    },
  });

  if (!link) {
    return;
  }

  // Remove the linked issue reference from the interaction
  await prisma.interaction.update({
    where: { id: link.internalId },
    data: {
      linkedIssueProvider: null,
      linkedIssueId: null,
      linkedIssueUrl: null,
    },
  });

  // Delete the integration link
  await prisma.integrationLink.delete({
    where: { id: link.id },
  });

  logger.info(
    { interactionId: link.internalId, linearIssueId },
    "Linear issue link removed",
  );
}
