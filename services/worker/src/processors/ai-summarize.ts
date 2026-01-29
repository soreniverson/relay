import { Job } from 'bullmq';
import OpenAI from 'openai';
import { prisma } from '../index.js';

interface AiSummarizeJob {
  interactionId: string;
  projectId: string;
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function aiSummarizeProcessor(job: Job<AiSummarizeJob>) {
  const { interactionId, projectId } = job.data;

  console.log(`Processing AI summarize for interaction ${interactionId}`);

  // Check if AI is enabled for this project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });

  const settings = project?.settings as Record<string, unknown> | null;
  if (!settings?.aiEnabled) {
    console.log(`AI disabled for project ${projectId}, skipping`);
    return { skipped: true, reason: 'ai_disabled' };
  }

  // Fetch the interaction with logs
  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
    include: {
      logs: true,
    },
  });

  if (!interaction) {
    throw new Error(`Interaction ${interactionId} not found`);
  }

  // Skip if already summarized
  if (interaction.aiSummary) {
    return { skipped: true, reason: 'already_summarized' };
  }

  // Build context for summarization
  const context = buildContext(interaction);

  // Generate summary
  const summary = await generateSummary(context);

  // Update interaction
  await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      aiSummary: summary,
      updatedAt: new Date(),
    },
  });

  return { success: true, summary };
}

function buildContext(interaction: any): string {
  const parts: string[] = [];

  // Main content
  if (interaction.contentText) {
    parts.push(`User Report: ${interaction.contentText}`);
  }

  const contentJson = interaction.contentJson as Record<string, unknown> | null;
  if (contentJson) {
    if (contentJson.title) {
      parts.push(`Title: ${contentJson.title}`);
    }
    if (contentJson.description) {
      parts.push(`Description: ${contentJson.description}`);
    }
    if (contentJson.steps && Array.isArray(contentJson.steps)) {
      parts.push(`Steps to reproduce:\n${contentJson.steps.join('\n')}`);
    }
  }

  // Console errors
  if (interaction.logs?.[0]?.console) {
    const console = interaction.logs[0].console as any[];
    const errors = console.filter((l) => l.level === 'error').slice(0, 5);
    if (errors.length > 0) {
      parts.push(
        `Console Errors:\n${errors.map((e) => e.message).join('\n')}`
      );
    }
  }

  // Network errors
  if (interaction.logs?.[0]?.network) {
    const network = interaction.logs[0].network as any[];
    const failed = network.filter((n) => n.status >= 400).slice(0, 5);
    if (failed.length > 0) {
      parts.push(
        `Failed Requests:\n${failed.map((n) => `${n.method} ${n.url} - ${n.status}`).join('\n')}`
      );
    }
  }

  return parts.join('\n\n');
}

async function generateSummary(context: string): Promise<string> {
  if (!openai) {
    // Fallback: simple extraction
    return extractFallbackSummary(context);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a bug report summarizer. Create a concise 1-2 sentence summary of the issue. Focus on:
1. What the user was trying to do
2. What went wrong
3. Any error messages or failed requests

Be technical but concise. Do not include any personally identifiable information.`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || extractFallbackSummary(context);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return extractFallbackSummary(context);
  }
}

function extractFallbackSummary(context: string): string {
  // Simple fallback: extract first sentence or truncate
  const lines = context.split('\n').filter((l) => l.trim());
  const firstMeaningful = lines.find(
    (l) => !l.startsWith('User Report:') && !l.startsWith('Title:')
  );

  if (firstMeaningful) {
    return firstMeaningful.slice(0, 200);
  }

  return context.slice(0, 200);
}
