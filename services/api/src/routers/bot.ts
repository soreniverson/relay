import { z } from "zod";
import {
  router,
  projectProcedure,
  publicProcedure,
  sdkProcedure,
} from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma";

// OpenAI API configuration
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Simple RAG search using text matching
// For production, consider using pgvector for semantic search
async function searchKnowledgeBase(
  projectId: string,
  query: string,
  limit = 5,
) {
  // Extract keywords for better matching
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const articles = await prisma.article.findMany({
    where: {
      projectId,
      status: "published",
      visibility: "public",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
        // Also search for individual keywords
        ...keywords.slice(0, 3).map((keyword) => ({
          OR: [
            { title: { contains: keyword, mode: "insensitive" as const } },
            { content: { contains: keyword, mode: "insensitive" as const } },
          ],
        })),
      ],
    },
    select: {
      id: true,
      title: true,
      content: true,
      slug: true,
    },
    take: limit,
  });

  // Calculate simple relevance score based on keyword matches
  return articles.map((a) => {
    const titleLower = a.title.toLowerCase();
    const contentLower = a.content.toLowerCase();
    const queryLower = query.toLowerCase();

    let score = 0;
    // Exact phrase match in title
    if (titleLower.includes(queryLower)) score += 1.0;
    // Exact phrase match in content
    if (contentLower.includes(queryLower)) score += 0.5;
    // Keyword matches
    keywords.forEach((kw) => {
      if (titleLower.includes(kw)) score += 0.3;
      if (contentLower.includes(kw)) score += 0.1;
    });

    return {
      id: a.id,
      title: a.title,
      content: a.content.slice(0, 1500), // Truncate for context window
      slug: a.slug,
      score: Math.min(score, 1), // Normalize to 0-1
    };
  }).sort((a, b) => b.score - a.score);
}

// Generate AI response using OpenAI
async function generateBotResponse(
  config: {
    name: string;
    personality: string;
    systemPrompt: string | null;
    model: string;
    temperature: number;
    maxTokens: number;
  },
  context: { id: string; title: string; content: string; score?: number }[],
  conversationHistory: { role: string; content: string }[],
  userMessage: string,
): Promise<{
  content: string;
  confidence: number;
  retrievedArticles: Array<{ id: string; title: string; score: number }>;
  promptTokens: number;
  completionTokens: number;
}> {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  // Build system prompt with RAG context
  const basePrompt =
    config.systemPrompt ||
    `You are ${config.name}, an AI support assistant. Your personality is ${config.personality}.

Key guidelines:
- Be helpful, accurate, and concise
- If you use information from the knowledge base, cite it naturally
- If you're uncertain or don't have enough information, be honest and offer to connect with a human agent
- Keep responses friendly but professional
- Don't make up information - only use what's in the knowledge base or is general knowledge`;

  const contextText =
    context.length > 0
      ? `\n\nRelevant knowledge base articles to reference:\n${context
          .map((c) => `### ${c.title}\n${c.content}`)
          .join("\n\n")}`
      : "\n\nNo directly relevant articles found in the knowledge base.";

  const systemPrompt =
    basePrompt +
    contextText +
    `\n\nRemember: If you cannot answer confidently, offer to connect the user with a human support agent.`;

  // Build messages array
  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of conversationHistory.slice(-10)) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  // If OpenAI API key is not configured, return a simulated response
  if (!openaiApiKey) {
    const hasRelevantContext = context.length > 0 && context[0].score && context[0].score > 0.3;

    if (hasRelevantContext) {
      return {
        content: `Based on our documentation about "${context[0].title}", ${context[0].content.slice(0, 200)}... I hope this helps! Let me know if you have more questions.`,
        confidence: 0.75,
        retrievedArticles: context.map((c) => ({
          id: c.id,
          title: c.title,
          score: c.score || 0.5,
        })),
        promptTokens: 500,
        completionTokens: 100,
      };
    } else {
      return {
        content: `I appreciate you reaching out! While I don't have specific information about that in my knowledge base, I'd be happy to connect you with a human support agent who can help you further. Would you like me to do that?`,
        confidence: 0.3,
        retrievedArticles: [],
        promptTokens: 300,
        completionTokens: 50,
      };
    }
  }

  // Call OpenAI API
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "gpt-4o-mini",
        messages,
        max_tokens: config.maxTokens || 500,
        temperature: config.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const assistantMessage = data.choices[0]?.message?.content || "";

    // Calculate confidence based on context relevance and response
    let confidence = 0.5; // Base confidence
    if (context.length > 0 && context[0].score) {
      confidence = Math.min(0.95, 0.5 + context[0].score * 0.4);
    }
    // Reduce confidence if response mentions uncertainty
    const uncertainPhrases = [
      "i don't have",
      "i'm not sure",
      "i cannot",
      "human agent",
      "i don't know",
      "uncertain",
    ];
    const responseLower = assistantMessage.toLowerCase();
    if (uncertainPhrases.some((phrase) => responseLower.includes(phrase))) {
      confidence = Math.min(confidence, 0.4);
    }

    return {
      content: assistantMessage,
      confidence,
      retrievedArticles: context.map((c) => ({
        id: c.id,
        title: c.title,
        score: c.score || 0.5,
      })),
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    };
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    // Fallback response on API error
    return {
      content: `I apologize, but I'm having trouble processing your request right now. Would you like me to connect you with a human support agent instead?`,
      confidence: 0.2,
      retrievedArticles: [],
      promptTokens: 0,
      completionTokens: 0,
    };
  }
}

export const botRouter = router({
  // ============================================================================
  // BOT CONFIGURATION
  // ============================================================================

  getConfig: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      let config = await ctx.prisma.botConfig.findUnique({
        where: { projectId: input.projectId },
      });

      // Create default config if doesn't exist
      if (!config) {
        config = await ctx.prisma.botConfig.create({
          data: { projectId: input.projectId },
        });
      }

      return config;
    }),

  updateConfig: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        enabled: z.boolean().optional(),
        name: z.string().min(1).optional(),
        avatar: z.string().optional(),
        personality: z.string().optional(),
        escalationThreshold: z.number().min(0).max(1).optional(),
        maxTurnsBeforeEscalation: z.number().min(1).optional(),
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(50).max(4000).optional(),
        systemPrompt: z.string().optional(),
        welcomeMessage: z.string().optional(),
        fallbackMessage: z.string().optional(),
        availableHours: z.any().optional(),
        timezone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...data } = input;

      const config = await ctx.prisma.botConfig.upsert({
        where: { projectId },
        update: data,
        create: { projectId, ...data },
      });

      return config;
    }),

  // ============================================================================
  // BOT CHAT (for SDK)
  // ============================================================================

  chat: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        conversationId: z.string(),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get bot config
      const config = await ctx.prisma.botConfig.findUnique({
        where: { projectId: input.projectId },
      });

      if (!config || !config.enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI bot is not enabled for this project",
        });
      }

      // Get conversation
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 20, // Last 20 messages for context
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Save user message
      await ctx.prisma.botMessage.create({
        data: {
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
        },
      });

      // Search knowledge base
      const relevantArticles = await searchKnowledgeBase(
        input.projectId,
        input.message,
      );

      // Build conversation history
      const history = conversation.messages.map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body,
      }));

      // Generate response
      const response = await generateBotResponse(
        {
          name: config.name,
          personality: config.personality,
          systemPrompt: config.systemPrompt,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        relevantArticles,
        history,
        input.message,
      );

      // Save bot message
      const botMessage = await ctx.prisma.botMessage.create({
        data: {
          conversationId: input.conversationId,
          role: "assistant",
          content: response.content,
          confidence: response.confidence,
          retrievedArticles: response.retrievedArticles as any,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
        },
      });

      // Also save to regular messages for conversation view
      await ctx.prisma.message.create({
        data: {
          projectId: input.projectId,
          conversationId: input.conversationId,
          direction: "outbound",
          body: response.content,
          meta: { fromBot: true, botMessageId: botMessage.id },
        },
      });

      // Update conversation
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 2 }, // User + bot message
        },
      });

      // Check if should escalate
      const shouldEscalate = response.confidence < config.escalationThreshold;

      if (shouldEscalate) {
        // Mark conversation for human review
        // In production, notify agents via Slack/email
      }

      return {
        message: response.content,
        confidence: response.confidence,
        shouldEscalate,
        relevantArticles: response.retrievedArticles,
      };
    }),

  // ============================================================================
  // COPILOT (for agents)
  // ============================================================================

  getSuggestions: projectProcedure
    .input(
      z.object({
        conversationId: z.string(),
        draft: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      const lastUserMessage = conversation.messages.find(
        (m) => m.direction === "inbound",
      );

      if (!lastUserMessage) {
        return {
          suggestedReplies: [],
          relevantArticles: [],
          detectedIntent: null,
        };
      }

      // Search knowledge base for relevant articles
      const relevantArticles = await searchKnowledgeBase(
        conversation.projectId,
        lastUserMessage.body,
        3,
      );

      // Generate suggested replies (in production, call LLM)
      const suggestedReplies = [
        `Thanks for reaching out! ${relevantArticles[0]?.content.slice(0, 100) || "Let me help you with that."}`,
        `I understand your concern. Could you provide more details about the issue?`,
        `I'd be happy to help! Let me look into this for you.`,
      ];

      // Detect intent (simplified - in production use classifier)
      let detectedIntent = "general_inquiry";
      const messageText = lastUserMessage.body.toLowerCase();
      if (
        messageText.includes("refund") ||
        messageText.includes("money back")
      ) {
        detectedIntent = "refund_request";
      } else if (
        messageText.includes("bug") ||
        messageText.includes("error") ||
        messageText.includes("broken")
      ) {
        detectedIntent = "bug_report";
      } else if (messageText.includes("how") || messageText.includes("help")) {
        detectedIntent = "how_to_question";
      }

      return {
        suggestedReplies,
        relevantArticles: relevantArticles.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
        })),
        detectedIntent,
      };
    }),

  summarizeConversation: projectProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
          user: true,
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // In production, call LLM to summarize
      const messageCount = conversation.messages.length;
      const userMessages = conversation.messages.filter(
        (m) => m.direction === "inbound",
      );

      // Simple sentiment analysis (in production use model)
      let sentiment: "positive" | "neutral" | "negative" = "neutral";
      const allText = userMessages
        .map((m) => m.body)
        .join(" ")
        .toLowerCase();
      if (
        allText.includes("thank") ||
        allText.includes("great") ||
        allText.includes("awesome")
      ) {
        sentiment = "positive";
      } else if (
        allText.includes("frustrated") ||
        allText.includes("angry") ||
        allText.includes("terrible")
      ) {
        sentiment = "negative";
      }

      return {
        summary: `${messageCount} message conversation with ${conversation.user?.name || "user"}. Topic: ${conversation.subject || "General inquiry"}.`,
        keyPoints: [
          `User initiated conversation about: ${conversation.subject || "general inquiry"}`,
          `${messageCount} messages exchanged`,
          `Current status: ${conversation.status}`,
        ],
        sentiment,
        suggestedTags: ["support", sentiment],
      };
    }),

  // ============================================================================
  // SDK ENDPOINTS (for Kai - the AI assistant)
  // ============================================================================

  // Get bot configuration for SDK
  sdkGetConfig: sdkProcedure.query(async ({ ctx }) => {
    let config = await ctx.prisma.botConfig.findUnique({
      where: { projectId: ctx.projectId },
    });

    if (!config) {
      return {
        enabled: false,
        name: "Kai",
        avatar: null,
        welcomeMessage: "Hi! I'm Kai, your AI assistant. How can I help you today?",
      };
    }

    return {
      enabled: config.enabled,
      name: config.name,
      avatar: config.avatar,
      welcomeMessage: config.welcomeMessage,
    };
  }),

  // Start a new bot conversation (for SDK)
  sdkStartConversation: sdkProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        userId: z.string().optional(),
        initialMessage: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get bot config
      const config = await ctx.prisma.botConfig.findUnique({
        where: { projectId: ctx.projectId },
      });

      if (!config || !config.enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI assistant is not enabled for this project",
        });
      }

      // Resolve internal user ID if provided
      let internalUserId: string | null = null;
      if (input.userId) {
        const user = await ctx.prisma.endUser.findUnique({
          where: {
            projectId_externalUserId: {
              projectId: ctx.projectId,
              externalUserId: input.userId,
            },
          },
        });
        internalUserId = user?.id || null;
      }

      // Create conversation
      const conversation = await ctx.prisma.conversation.create({
        data: {
          projectId: ctx.projectId,
          sessionId: input.sessionId,
          userId: internalUserId,
          subject: "AI Assistant Chat",
          status: "open",
        },
      });

      // If initial message provided, process it
      if (input.initialMessage) {
        // Save user message
        await ctx.prisma.message.create({
          data: {
            projectId: ctx.projectId,
            conversationId: conversation.id,
            direction: "inbound",
            body: input.initialMessage,
          },
        });

        await ctx.prisma.botMessage.create({
          data: {
            conversationId: conversation.id,
            role: "user",
            content: input.initialMessage,
          },
        });

        // Search knowledge base
        const relevantArticles = await searchKnowledgeBase(
          ctx.projectId,
          input.initialMessage,
        );

        // Generate response
        const response = await generateBotResponse(
          {
            name: config.name,
            personality: config.personality,
            systemPrompt: config.systemPrompt,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
          },
          relevantArticles,
          [],
          input.initialMessage,
        );

        // Save bot response
        const botMessage = await ctx.prisma.botMessage.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: response.content,
            confidence: response.confidence,
            retrievedArticles: response.retrievedArticles as any,
            promptTokens: response.promptTokens,
            completionTokens: response.completionTokens,
          },
        });

        await ctx.prisma.message.create({
          data: {
            projectId: ctx.projectId,
            conversationId: conversation.id,
            direction: "outbound",
            body: response.content,
            meta: { fromBot: true, botMessageId: botMessage.id },
          },
        });

        // Update conversation
        await ctx.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            messageCount: 2,
          },
        });

        return {
          conversationId: conversation.id,
          botName: config.name,
          initialResponse: {
            message: response.content,
            confidence: response.confidence,
            shouldEscalate: response.confidence < config.escalationThreshold,
            relevantArticles: response.retrievedArticles,
          },
        };
      }

      // Return conversation with welcome message
      return {
        conversationId: conversation.id,
        botName: config.name,
        welcomeMessage: config.welcomeMessage,
      };
    }),

  // Send message to bot (for SDK)
  sdkChat: sdkProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        message: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get bot config
      const config = await ctx.prisma.botConfig.findUnique({
        where: { projectId: ctx.projectId },
      });

      if (!config || !config.enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI assistant is not enabled for this project",
        });
      }

      // Get conversation and verify it belongs to this project
      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.conversationId,
          projectId: ctx.projectId,
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 20,
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Save user message
      await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId: input.conversationId,
          direction: "inbound",
          body: input.message,
        },
      });

      await ctx.prisma.botMessage.create({
        data: {
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
        },
      });

      // Search knowledge base
      const relevantArticles = await searchKnowledgeBase(
        ctx.projectId,
        input.message,
      );

      // Build conversation history
      const history = conversation.messages.map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body,
      }));

      // Generate response
      const response = await generateBotResponse(
        {
          name: config.name,
          personality: config.personality,
          systemPrompt: config.systemPrompt,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        relevantArticles,
        history,
        input.message,
      );

      // Save bot message
      const botMessage = await ctx.prisma.botMessage.create({
        data: {
          conversationId: input.conversationId,
          role: "assistant",
          content: response.content,
          confidence: response.confidence,
          retrievedArticles: response.retrievedArticles as any,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
        },
      });

      await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId: input.conversationId,
          direction: "outbound",
          body: response.content,
          meta: { fromBot: true, botMessageId: botMessage.id },
        },
      });

      // Update conversation
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 2 },
        },
      });

      // Check if should escalate
      const shouldEscalate = response.confidence < config.escalationThreshold;

      // Handle escalation - add a note to the conversation for human review
      if (shouldEscalate) {
        // Create a system message noting escalation
        await ctx.prisma.message.create({
          data: {
            projectId: ctx.projectId,
            conversationId: input.conversationId,
            direction: "outbound",
            body: "[System: Conversation flagged for human review due to low confidence response]",
            meta: {
              isSystemMessage: true,
              needsHumanReview: true,
              escalationReason: "Low confidence response",
              escalatedAt: new Date().toISOString(),
            },
          },
        });

        // TODO: Send notification to agents via configured integrations (Slack/Discord)
      }

      return {
        message: response.content,
        confidence: response.confidence,
        shouldEscalate,
        relevantArticles: response.retrievedArticles,
        botName: config.name,
      };
    }),

  // Request to speak with human (for SDK)
  sdkEscalateToHuman: sdkProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.conversationId,
          projectId: ctx.projectId,
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      // Create escalation system message and bot response
      await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId: input.conversationId,
          direction: "outbound",
          body: "[System: User requested to speak with a human agent]",
          meta: {
            isSystemMessage: true,
            needsHumanReview: true,
            escalationReason: input.reason || "User requested human agent",
            escalatedAt: new Date().toISOString(),
            userRequestedEscalation: true,
          },
        },
      });

      // Add bot response to user
      await ctx.prisma.message.create({
        data: {
          projectId: ctx.projectId,
          conversationId: input.conversationId,
          direction: "outbound",
          body: "I've requested a human support agent to help you. They'll be with you shortly. In the meantime, is there anything else I can try to help with?",
          meta: { fromBot: true, isEscalationMessage: true },
        },
      });

      return {
        success: true,
        message: "A human support agent has been notified and will join the conversation soon.",
      };
    }),

  // Get conversation history (for SDK)
  sdkGetHistory: sdkProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        limit: z.number().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.conversationId,
          projectId: ctx.projectId,
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: input.limit,
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return {
        conversationId: conversation.id,
        status: conversation.status,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.direction === "inbound" ? "user" : "assistant",
          content: m.body,
          timestamp: m.createdAt,
          isFromBot: (m.meta as any)?.fromBot || false,
        })),
      };
    }),
});
