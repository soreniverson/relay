/**
 * Slack Webhook Client
 * Handles sending notifications to Slack via incoming webhooks.
 */

interface SlackConfig {
  webhookUrl: string;
}

interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  accessory?: {
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    url?: string;
    action_id?: string;
  };
  elements?: SlackElement[];
}

interface SlackElement {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  url?: string;
  action_id?: string;
}

interface SlackAttachment {
  color?: string;
  blocks?: SlackBlock[];
  fallback?: string;
}

// Severity to color mapping
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626", // red-600
  high: "#ea580c", // orange-600
  med: "#ca8a04", // yellow-600
  low: "#65a30d", // lime-600
};

// Interaction type to color mapping
const TYPE_COLORS: Record<string, string> = {
  bug: "#dc2626", // red
  feedback: "#2563eb", // blue
  chat: "#7c3aed", // violet
  survey: "#059669", // emerald
};

export class SlackClient {
  private webhookUrl: string;

  constructor(config: SlackConfig) {
    this.webhookUrl = config.webhookUrl;
  }

  /**
   * Send a message to Slack
   */
  async send(message: SlackMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Slack webhook error: ${error}`);
    }
  }

  /**
   * Send a simple text message
   */
  async sendText(text: string): Promise<void> {
    await this.send({ text });
  }

  /**
   * Send a rich notification for a new interaction
   */
  async sendInteractionNotification(data: {
    type: "bug" | "feedback" | "chat";
    title?: string;
    description?: string;
    severity?: string;
    userName?: string;
    userEmail?: string;
    url: string;
    relayUrl: string;
  }): Promise<void> {
    const typeLabels: Record<string, string> = {
      bug: "Bug Report",
      feedback: "Feedback",
      chat: "New Chat",
    };

    const typeEmoji: Record<string, string> = {
      bug: ":bug:",
      feedback: ":bulb:",
      chat: ":speech_balloon:",
    };

    const color = data.severity
      ? SEVERITY_COLORS[data.severity]
      : TYPE_COLORS[data.type];

    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${typeEmoji[data.type] || ":bell:"} *New ${typeLabels[data.type] || "Interaction"}*`,
        },
      },
    ];

    if (data.title) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${data.title}*`,
        },
      });
    }

    if (data.description) {
      const truncatedDescription =
        data.description.length > 500
          ? data.description.slice(0, 497) + "..."
          : data.description;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: truncatedDescription,
        },
      });
    }

    // Add context with user info, severity, and page URL
    const contextElements: string[] = [];
    if (data.userName || data.userEmail) {
      contextElements.push(
        `:bust_in_silhouette: ${data.userName || data.userEmail}`,
      );
    }
    if (data.severity) {
      const severityEmoji: Record<string, string> = {
        critical: ":rotating_light:",
        high: ":warning:",
        med: ":large_yellow_circle:",
        low: ":large_blue_circle:",
      };
      contextElements.push(
        `${severityEmoji[data.severity] || ""} ${data.severity.toUpperCase()}`,
      );
    }
    if (data.url) {
      contextElements.push(`:link: ${data.url}`);
    }

    if (contextElements.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: contextElements.join(" | "),
        },
      });
    }

    // Add action button
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
          url: data.relayUrl,
          action_id: "view_in_relay",
        },
      ],
    });

    await this.send({
      attachments: [
        {
          color,
          blocks,
          fallback: `New ${typeLabels[data.type]}: ${data.title || data.description?.slice(0, 100) || "No description"}`,
        },
      ],
    });
  }

  /**
   * Send a notification for high severity bugs
   */
  async sendHighSeverityAlert(data: {
    title?: string;
    description?: string;
    severity: string;
    userName?: string;
    userEmail?: string;
    url: string;
    relayUrl: string;
  }): Promise<void> {
    const severityEmoji: Record<string, string> = {
      critical: ":rotating_light:",
      high: ":warning:",
    };

    await this.send({
      text: `${severityEmoji[data.severity] || ":warning:"} *${data.severity.toUpperCase()} Severity Bug Reported*`,
      attachments: [
        {
          color: SEVERITY_COLORS[data.severity],
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: data.title
                  ? `*${data.title}*`
                  : (data.description?.slice(0, 200) || "No description"),
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  data.userName || data.userEmail
                    ? `:bust_in_silhouette: ${data.userName || data.userEmail}`
                    : null,
                  `:link: ${data.url}`,
                ]
                  .filter(Boolean)
                  .join(" | "),
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View in Relay",
                    emoji: true,
                  },
                  url: data.relayUrl,
                  action_id: "view_in_relay",
                },
              ],
            },
          ],
        },
      ],
    });
  }

  /**
   * Send a notification for new feedback
   */
  async sendFeedbackNotification(data: {
    title?: string;
    description?: string;
    category?: string;
    rating?: number;
    userName?: string;
    userEmail?: string;
    relayUrl: string;
  }): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":bulb: *New Feedback Received*",
        },
      },
    ];

    if (data.title) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${data.title}*`,
        },
      });
    }

    if (data.description) {
      const truncatedDescription =
        data.description.length > 500
          ? data.description.slice(0, 497) + "..."
          : data.description;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: truncatedDescription,
        },
      });
    }

    const contextParts: string[] = [];
    if (data.userName || data.userEmail) {
      contextParts.push(
        `:bust_in_silhouette: ${data.userName || data.userEmail}`,
      );
    }
    if (data.category) {
      contextParts.push(`:label: ${data.category}`);
    }
    if (data.rating !== undefined) {
      const stars = ":star:".repeat(Math.round(data.rating));
      contextParts.push(`${stars} (${data.rating}/5)`);
    }

    if (contextParts.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: contextParts.join(" | "),
        },
      });
    }

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
          url: data.relayUrl,
          action_id: "view_in_relay",
        },
      ],
    });

    await this.send({
      attachments: [
        {
          color: TYPE_COLORS.feedback,
          blocks,
          fallback: `New feedback: ${data.title || data.description?.slice(0, 100) || "No description"}`,
        },
      ],
    });
  }

  /**
   * Send a notification for new chat message
   */
  async sendChatNotification(data: {
    message: string;
    userName?: string;
    userEmail?: string;
    conversationId: string;
    relayUrl: string;
  }): Promise<void> {
    const truncatedMessage =
      data.message.length > 300
        ? data.message.slice(0, 297) + "..."
        : data.message;

    await this.send({
      attachments: [
        {
          color: TYPE_COLORS.chat,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: ":speech_balloon: *New Chat Message*",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `> ${truncatedMessage}`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: data.userName || data.userEmail
                  ? `:bust_in_silhouette: ${data.userName || data.userEmail}`
                  : "_Anonymous user_",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Reply in Relay",
                    emoji: true,
                  },
                  url: data.relayUrl,
                  action_id: "view_in_relay",
                },
              ],
            },
          ],
          fallback: `New chat message: ${truncatedMessage}`,
        },
      ],
    });
  }
}

/**
 * Verify Slack request signature for interactive components
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string,
  signingSecret: string,
): boolean {
  const crypto = require("crypto");

  // Check timestamp is within 5 minutes
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 60 * 5) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBaseString)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature),
  );
}
