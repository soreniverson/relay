import { Job } from "bullmq";
import OpenAI from "openai";
import { prisma } from "../index.js";
import crypto from "crypto";

interface AiDedupeJob {
  interactionId?: string;
  projectId?: string;
  type?: "new" | "periodic";
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function aiDedupeProcessor(job: Job<AiDedupeJob>) {
  const { interactionId, projectId, type } = job.data;

  if (type === "periodic") {
    return await runPeriodicDeduplication();
  }

  if (!interactionId || !projectId) {
    throw new Error("interactionId and projectId required for new dedupe");
  }

  console.log(`Processing dedupe for interaction ${interactionId}`);

  // Check if AI is enabled
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });

  const settings = project?.settings as Record<string, unknown> | null;
  if (!settings?.aiEnabled) {
    return { skipped: true, reason: "ai_disabled" };
  }

  // Fetch the new interaction
  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
  });

  if (!interaction) {
    throw new Error(`Interaction ${interactionId} not found`);
  }

  // Only dedupe bugs and feedback
  if (!["bug", "feedback"].includes(interaction.type)) {
    return { skipped: true, reason: "not_applicable_type" };
  }

  // Get recent similar interactions
  const candidates = await findSimilarCandidates(interaction);

  if (candidates.length === 0) {
    // Create new group
    const groupId = generateGroupId(interaction);
    await prisma.interaction.update({
      where: { id: interactionId },
      data: { aiDuplicateGroupId: groupId },
    });
    return { success: true, groupId, isNew: true };
  }

  // Find best match
  const match = await findBestMatch(interaction, candidates);

  if (match) {
    await prisma.interaction.update({
      where: { id: interactionId },
      data: {
        aiDuplicateGroupId: match.groupId,
        aiConfidence: match.confidence,
      },
    });
    return {
      success: true,
      groupId: match.groupId,
      matchedWith: match.interactionId,
      confidence: match.confidence,
    };
  }

  // No match found, create new group
  const groupId = generateGroupId(interaction);
  await prisma.interaction.update({
    where: { id: interactionId },
    data: { aiDuplicateGroupId: groupId },
  });
  return { success: true, groupId, isNew: true };
}

async function findSimilarCandidates(interaction: any) {
  // Get interactions from the same project in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await prisma.interaction.findMany({
    where: {
      projectId: interaction.projectId,
      type: interaction.type,
      id: { not: interaction.id },
      createdAt: { gte: thirtyDaysAgo },
      aiDuplicateGroupId: { not: null },
    },
    select: {
      id: true,
      contentText: true,
      contentJson: true,
      aiDuplicateGroupId: true,
      aiLabels: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

async function findBestMatch(
  interaction: any,
  candidates: any[],
): Promise<{
  groupId: string;
  interactionId: string;
  confidence: number;
} | null> {
  const interactionText = extractText(interaction);

  // First pass: simple text similarity
  const scoredCandidates = candidates.map((c) => ({
    ...c,
    similarity: calculateSimilarity(interactionText, extractText(c)),
  }));

  // Filter to top candidates with > 0.5 similarity
  const topCandidates = scoredCandidates
    .filter((c) => c.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  if (topCandidates.length === 0) {
    return null;
  }

  // If we have OpenAI, use it for more accurate matching
  if (openai && topCandidates.length > 0) {
    try {
      const result = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are a duplicate bug detector. Compare the NEW bug report with EXISTING reports and determine if any are duplicates (same root cause).

Respond with JSON: {"match": "id_of_best_match" or null, "confidence": 0.0-1.0}

Only return a match if confidence > 0.7.`,
          },
          {
            role: "user",
            content: `NEW REPORT:
${interactionText}

EXISTING REPORTS:
${topCandidates.map((c) => `[${c.id}]: ${extractText(c)}`).join("\n\n")}`,
          },
        ],
        max_tokens: 100,
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const result_1 = JSON.parse(result.choices[0]?.message?.content || "{}");

      if (result_1.match && result_1.confidence > 0.7) {
        const matched = topCandidates.find((c) => c.id === result_1.match);
        if (matched) {
          return {
            groupId: matched.aiDuplicateGroupId!,
            interactionId: matched.id,
            confidence: result_1.confidence,
          };
        }
      }
    } catch (error) {
      console.error("OpenAI dedupe error:", error);
    }
  }

  // Fallback: use simple similarity threshold
  const best = topCandidates[0];
  if (best && best.similarity > 0.8) {
    return {
      groupId: best.aiDuplicateGroupId!,
      interactionId: best.id,
      confidence: best.similarity,
    };
  }

  return null;
}

function extractText(interaction: any): string {
  const parts: string[] = [];

  if (interaction.contentText) {
    parts.push(interaction.contentText);
  }

  const contentJson = interaction.contentJson as Record<string, unknown> | null;
  if (contentJson) {
    if (contentJson.title) parts.push(String(contentJson.title));
    if (contentJson.description) parts.push(String(contentJson.description));
  }

  return parts.join(" ").toLowerCase();
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simple Jaccard similarity on words
  const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

function generateGroupId(interaction: any): string {
  const text = extractText(interaction);
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  return `grp_${hash.slice(0, 16)}`;
}

async function runPeriodicDeduplication() {
  console.log("Running periodic deduplication scan...");

  // Get all projects with AI enabled
  const projects = await prisma.project.findMany({
    select: { id: true, settings: true },
  });

  let processed = 0;

  for (const project of projects) {
    const settings = project.settings as Record<string, unknown> | null;
    if (!settings?.aiEnabled) continue;

    // Find ungrouped interactions
    const ungrouped = await prisma.interaction.findMany({
      where: {
        projectId: project.id,
        type: { in: ["bug", "feedback"] },
        aiDuplicateGroupId: null,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      take: 50,
    });

    for (const interaction of ungrouped) {
      const candidates = await findSimilarCandidates(interaction);
      const match = await findBestMatch(interaction, candidates);

      if (match) {
        await prisma.interaction.update({
          where: { id: interaction.id },
          data: {
            aiDuplicateGroupId: match.groupId,
            aiConfidence: match.confidence,
          },
        });
      } else {
        const groupId = generateGroupId(interaction);
        await prisma.interaction.update({
          where: { id: interaction.id },
          data: { aiDuplicateGroupId: groupId },
        });
      }

      processed++;
    }
  }

  return { success: true, processed };
}
