import { z } from 'zod';
import { router, projectProcedure, publicProcedure, sdkProcedure } from '../lib/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../lib/prisma';

// Simple RAG search using text matching (in production, use pgvector)
async function searchKnowledgeBase(projectId: string, query: string, limit = 5) {
  const articles = await prisma.article.findMany({
    where: {
      projectId,
      status: 'published',
      visibility: 'public',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
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

  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content.slice(0, 1000), // Truncate for context
    slug: a.slug,
    score: 1, // In production, this would be similarity score
  }));
}

// Generate AI response
async function generateBotResponse(
  config: {
    name: string;
    personality: string;
    systemPrompt: string | null;
    model: string;
    temperature: number;
    maxTokens: number;
  },
  context: { id: string; title: string; content: string }[],
  conversationHistory: { role: string; content: string }[],
  userMessage: string
) {
  // Build system prompt
  const basePrompt = config.systemPrompt || `You are ${config.name}, a helpful AI support assistant. Be ${config.personality} and concise.`;

  const contextText = context.length > 0
    ? `\n\nRelevant knowledge base articles:\n${context.map(c => `## ${c.title}\n${c.content}`).join('\n\n')}`
    : '';

  const systemPrompt = basePrompt + contextText + `\n\nIf you don't have enough information to answer, say so honestly and offer to connect the user with a human agent.`;

  // In production, call OpenAI/Anthropic API here
  // For now, return a simulated response
  const hasRelevantContext = context.length > 0;

  if (hasRelevantContext) {
    return {
      content: `Based on our documentation, ${context[0].content.slice(0, 200)}... You can read more about this in our help center article: "${context[0].title}".`,
      confidence: 0.85,
      retrievedArticles: context.map(c => ({ id: c.id, title: c.title, score: 1 })),
      promptTokens: 500,
      completionTokens: 100,
    };
  } else {
    return {
      content: `I don't have specific information about that in my knowledge base. Would you like me to connect you with a human support agent who can help you further?`,
      confidence: 0.3,
      retrievedArticles: [],
      promptTokens: 300,
      completionTokens: 50,
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
      })
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get bot config
      const config = await ctx.prisma.botConfig.findUnique({
        where: { projectId: input.projectId },
      });

      if (!config || !config.enabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'AI bot is not enabled for this project',
        });
      }

      // Get conversation
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20, // Last 20 messages for context
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        });
      }

      // Save user message
      await ctx.prisma.botMessage.create({
        data: {
          conversationId: input.conversationId,
          role: 'user',
          content: input.message,
        },
      });

      // Search knowledge base
      const relevantArticles = await searchKnowledgeBase(
        input.projectId,
        input.message
      );

      // Build conversation history
      const history = conversation.messages.map((m) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
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
        input.message
      );

      // Save bot message
      const botMessage = await ctx.prisma.botMessage.create({
        data: {
          conversationId: input.conversationId,
          role: 'assistant',
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
          direction: 'outbound',
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
      })
    )
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        });
      }

      const lastUserMessage = conversation.messages.find(
        (m) => m.direction === 'inbound'
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
        3
      );

      // Generate suggested replies (in production, call LLM)
      const suggestedReplies = [
        `Thanks for reaching out! ${relevantArticles[0]?.content.slice(0, 100) || 'Let me help you with that.'}`,
        `I understand your concern. Could you provide more details about the issue?`,
        `I'd be happy to help! Let me look into this for you.`,
      ];

      // Detect intent (simplified - in production use classifier)
      let detectedIntent = 'general_inquiry';
      const messageText = lastUserMessage.body.toLowerCase();
      if (messageText.includes('refund') || messageText.includes('money back')) {
        detectedIntent = 'refund_request';
      } else if (messageText.includes('bug') || messageText.includes('error') || messageText.includes('broken')) {
        detectedIntent = 'bug_report';
      } else if (messageText.includes('how') || messageText.includes('help')) {
        detectedIntent = 'how_to_question';
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
            orderBy: { createdAt: 'asc' },
          },
          user: true,
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        });
      }

      // In production, call LLM to summarize
      const messageCount = conversation.messages.length;
      const userMessages = conversation.messages.filter(
        (m) => m.direction === 'inbound'
      );

      // Simple sentiment analysis (in production use model)
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      const allText = userMessages.map((m) => m.body).join(' ').toLowerCase();
      if (allText.includes('thank') || allText.includes('great') || allText.includes('awesome')) {
        sentiment = 'positive';
      } else if (allText.includes('frustrated') || allText.includes('angry') || allText.includes('terrible')) {
        sentiment = 'negative';
      }

      return {
        summary: `${messageCount} message conversation with ${conversation.user?.name || 'user'}. Topic: ${conversation.subject || 'General inquiry'}.`,
        keyPoints: [
          `User initiated conversation about: ${conversation.subject || 'general inquiry'}`,
          `${messageCount} messages exchanged`,
          `Current status: ${conversation.status}`,
        ],
        sentiment,
        suggestedTags: ['support', sentiment],
      };
    }),
});
