// ============================================================================
// DISCORD WEBHOOK CLIENT
// Uses Discord Webhook API to send notifications
// ============================================================================

export interface DiscordClientConfig {
  webhookUrl: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: {
    url: string;
  };
}

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

// Discord embed color constants
export const DISCORD_COLORS = {
  RED: 0xed4245, // Bug, Critical
  ORANGE: 0xf57c00, // High severity
  YELLOW: 0xfee75c, // Medium severity
  GREEN: 0x57f287, // Success, Resolved
  BLUE: 0x5865f2, // Info, Feedback
  PURPLE: 0x9b59b6, // Feature request
  GRAY: 0x95a5a6, // Default
};

export class DiscordClient {
  private webhookUrl: string;

  constructor(config: DiscordClientConfig) {
    this.webhookUrl = config.webhookUrl;
  }

  /**
   * Send a message to Discord via webhook
   */
  async send(message: DiscordMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      let errorMessage = `Discord webhook error: ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Send a simple text message
   */
  async sendText(text: string): Promise<void> {
    await this.send({ content: text });
  }

  /**
   * Send a bug report notification
   */
  async sendBugReport(data: {
    title: string;
    description?: string;
    severity?: string;
    userEmail?: string;
    pageUrl?: string;
    relayUrl: string;
  }): Promise<void> {
    const severityColors: Record<string, number> = {
      critical: DISCORD_COLORS.RED,
      high: DISCORD_COLORS.ORANGE,
      med: DISCORD_COLORS.YELLOW,
      low: DISCORD_COLORS.BLUE,
    };

    const fields: DiscordEmbed["fields"] = [];

    if (data.severity) {
      fields.push({
        name: "Severity",
        value: data.severity.charAt(0).toUpperCase() + data.severity.slice(1),
        inline: true,
      });
    }

    if (data.userEmail) {
      fields.push({
        name: "Reported by",
        value: data.userEmail,
        inline: true,
      });
    }

    if (data.pageUrl) {
      fields.push({
        name: "Page",
        value: data.pageUrl,
        inline: false,
      });
    }

    await this.send({
      username: "Relay",
      embeds: [
        {
          title: `🐛 ${data.title}`,
          description: data.description,
          color: severityColors[data.severity || ""] || DISCORD_COLORS.RED,
          url: data.relayUrl,
          fields,
          timestamp: new Date().toISOString(),
          footer: {
            text: "Relay Bug Report",
          },
        },
      ],
    });
  }

  /**
   * Send a feedback notification
   */
  async sendFeedback(data: {
    title: string;
    description?: string;
    category?: string;
    userEmail?: string;
    relayUrl: string;
  }): Promise<void> {
    const fields: DiscordEmbed["fields"] = [];

    if (data.category) {
      fields.push({
        name: "Category",
        value: data.category,
        inline: true,
      });
    }

    if (data.userEmail) {
      fields.push({
        name: "From",
        value: data.userEmail,
        inline: true,
      });
    }

    await this.send({
      username: "Relay",
      embeds: [
        {
          title: `💡 ${data.title}`,
          description: data.description,
          color: DISCORD_COLORS.PURPLE,
          url: data.relayUrl,
          fields,
          timestamp: new Date().toISOString(),
          footer: {
            text: "Relay Feedback",
          },
        },
      ],
    });
  }

  /**
   * Send a new chat notification
   */
  async sendChatNotification(data: {
    message: string;
    userEmail?: string;
    relayUrl: string;
  }): Promise<void> {
    const fields: DiscordEmbed["fields"] = [];

    if (data.userEmail) {
      fields.push({
        name: "From",
        value: data.userEmail,
        inline: true,
      });
    }

    await this.send({
      username: "Relay",
      embeds: [
        {
          title: "💬 New Chat Message",
          description: data.message.slice(0, 500),
          color: DISCORD_COLORS.BLUE,
          url: data.relayUrl,
          fields,
          timestamp: new Date().toISOString(),
          footer: {
            text: "Relay Chat",
          },
        },
      ],
    });
  }

  /**
   * Send a custom embed message
   */
  async sendEmbed(embed: DiscordEmbed): Promise<void> {
    await this.send({
      username: "Relay",
      embeds: [embed],
    });
  }

  /**
   * Test the webhook connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.send({
        username: "Relay",
        embeds: [
          {
            title: "✅ Relay Connected",
            description: "Your Discord integration is now active!",
            color: DISCORD_COLORS.GREEN,
            timestamp: new Date().toISOString(),
            footer: {
              text: "Relay",
            },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }
}
