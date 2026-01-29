import { Job } from "bullmq";
import { prisma } from "../index.js";

interface SlackNotifyJob {
  type: "new_bug" | "new_feedback" | "new_chat" | "status_change";
  interactionId: string;
  projectId: string;
  metadata?: Record<string, unknown>;
}

export async function slackNotifyProcessor(job: Job<SlackNotifyJob>) {
  const { type, interactionId, projectId, metadata } = job.data;

  console.log(`Processing Slack notification: ${type} for ${interactionId}`);

  // Get integration config
  const integration = await prisma.integration.findUnique({
    where: {
      projectId_provider: {
        projectId,
        provider: "slack",
      },
    },
  });

  if (!integration || !integration.enabled) {
    return { skipped: true, reason: "integration_disabled" };
  }

  const config = integration.config as Record<string, unknown>;
  const webhookUrl = config.webhookUrl as string;
  const channel = config.channel as string;

  if (!webhookUrl) {
    throw new Error("Slack webhook URL not configured");
  }

  // Fetch interaction
  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
    include: {
      user: true,
      media: { where: { kind: "screenshot" }, take: 1 },
    },
  });

  if (!interaction) {
    throw new Error(`Interaction ${interactionId} not found`);
  }

  // Build Slack message
  const message = buildSlackMessage(type, interaction, metadata);

  // Send to Slack
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack API error: ${response.status} ${text}`);
  }

  return { success: true };
}

function buildSlackMessage(
  type: string,
  interaction: any,
  metadata?: Record<string, unknown>,
) {
  const relayUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  const interactionUrl = `${relayUrl}/dashboard/inbox/${interaction.id}`;

  const contentJson = interaction.contentJson as Record<string, unknown> | null;
  const title =
    contentJson?.title || interaction.contentText?.slice(0, 100) || "Untitled";

  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    med: "🟡",
    low: "🟢",
  };

  const typeEmoji: Record<string, string> = {
    bug: "🐛",
    feedback: "💬",
    chat: "💭",
  };

  const blocks: any[] = [];

  // Header
  switch (type) {
    case "new_bug":
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: `${typeEmoji.bug} New Bug Report`,
          emoji: true,
        },
      });
      break;
    case "new_feedback":
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: `${typeEmoji.feedback} New Feedback`,
          emoji: true,
        },
      });
      break;
    case "new_chat":
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: `${typeEmoji.chat} New Chat Message`,
          emoji: true,
        },
      });
      break;
    case "status_change":
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: `📋 Status Updated`,
          emoji: true,
        },
      });
      break;
  }

  // Content section
  const fields: any[] = [];

  if (interaction.severity) {
    fields.push({
      type: "mrkdwn",
      text: `*Severity:* ${severityEmoji[interaction.severity] || ""} ${interaction.severity}`,
    });
  }

  if (interaction.user) {
    fields.push({
      type: "mrkdwn",
      text: `*User:* ${interaction.user.name || interaction.user.email || "Anonymous"}`,
    });
  }

  if (interaction.status) {
    fields.push({
      type: "mrkdwn",
      text: `*Status:* ${interaction.status}`,
    });
  }

  if (metadata?.oldStatus && metadata?.newStatus) {
    fields.push({
      type: "mrkdwn",
      text: `*Changed:* ${metadata.oldStatus} → ${metadata.newStatus}`,
    });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${title}*`,
    },
    ...(fields.length > 0 && { fields }),
  });

  // Description if available
  const description = contentJson?.description || interaction.contentText;
  if (description && description.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          description.slice(0, 500) + (description.length > 500 ? "..." : ""),
      },
    });
  }

  // AI Summary if available
  if (interaction.aiSummary) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🤖 *AI Summary:* ${interaction.aiSummary}`,
        },
      ],
    });
  }

  // Screenshot if available
  if (interaction.media?.[0]?.url) {
    blocks.push({
      type: "image",
      image_url: interaction.media[0].url,
      alt_text: "Screenshot",
    });
  }

  // Action button
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in Relay",
          emoji: true,
        },
        url: interactionUrl,
        action_id: "view_in_relay",
      },
    ],
  });

  // Divider
  blocks.push({ type: "divider" });

  return { blocks };
}
