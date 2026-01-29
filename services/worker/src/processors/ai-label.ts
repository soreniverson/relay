import { Job } from "bullmq";
import OpenAI from "openai";
import { prisma } from "../index.js";

interface AiLabelJob {
  interactionId: string;
  projectId: string;
}

const PREDEFINED_LABELS = [
  "bug",
  "crash",
  "performance",
  "ui",
  "ux",
  "api",
  "authentication",
  "data-loss",
  "security",
  "mobile",
  "desktop",
  "browser-specific",
  "network",
  "timeout",
  "validation",
  "feature-request",
  "documentation",
  "accessibility",
];

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function aiLabelProcessor(job: Job<AiLabelJob>) {
  const { interactionId, projectId } = job.data;

  console.log(`Processing AI label for interaction ${interactionId}`);

  // Check if AI is enabled
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { settings: true },
  });

  const settings = project?.settings as Record<string, unknown> | null;
  if (!settings?.aiEnabled) {
    return { skipped: true, reason: "ai_disabled" };
  }

  // Fetch interaction
  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
    include: { logs: true },
  });

  if (!interaction) {
    throw new Error(`Interaction ${interactionId} not found`);
  }

  // Skip if already labeled by AI
  if (interaction.aiLabels && (interaction.aiLabels as string[]).length > 0) {
    return { skipped: true, reason: "already_labeled" };
  }

  // Build context
  const context = buildLabelContext(interaction);

  // Generate labels
  const { labels, confidence } = await generateLabels(context);

  // Update interaction
  await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      aiLabels: labels,
      aiConfidence: confidence,
      updatedAt: new Date(),
    },
  });

  return { success: true, labels, confidence };
}

function buildLabelContext(interaction: any): string {
  const parts: string[] = [];

  parts.push(`Type: ${interaction.type}`);

  if (interaction.contentText) {
    parts.push(`Content: ${interaction.contentText}`);
  }

  const contentJson = interaction.contentJson as Record<string, unknown> | null;
  if (contentJson) {
    if (contentJson.title) parts.push(`Title: ${contentJson.title}`);
    if (contentJson.description)
      parts.push(`Description: ${contentJson.description}`);
  }

  // Add error context
  if (interaction.logs?.[0]?.errors) {
    const errors = interaction.logs[0].errors as any[];
    if (errors.length > 0) {
      parts.push(`Errors: ${errors.map((e) => e.message).join(", ")}`);
    }
  }

  // Add technical context
  const techContext = interaction.technicalContext as Record<
    string,
    unknown
  > | null;
  if (techContext) {
    if (techContext.url) parts.push(`URL: ${techContext.url}`);
    if (techContext.userAgent)
      parts.push(`User Agent: ${techContext.userAgent}`);
  }

  return parts.join("\n");
}

async function generateLabels(
  context: string,
): Promise<{ labels: string[]; confidence: number }> {
  // First, apply deterministic rules
  const deterministicLabels = applyDeterministicRules(context);

  if (!openai) {
    return { labels: deterministicLabels, confidence: 0.7 };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a bug report classifier. Analyze the report and assign 1-3 relevant labels from this list:
${PREDEFINED_LABELS.join(", ")}

Respond with JSON only: {"labels": ["label1", "label2"], "confidence": 0.85}

Only use labels from the provided list. Confidence should be 0.0-1.0 based on how certain you are.`,
        },
        {
          role: "user",
          content: context,
        },
      ],
      max_tokens: 100,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    const aiLabels = (result.labels || []).filter((l: string) =>
      PREDEFINED_LABELS.includes(l),
    );

    // Merge with deterministic labels
    const allLabels = [...new Set([...deterministicLabels, ...aiLabels])];

    return {
      labels: allLabels.slice(0, 5),
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return { labels: deterministicLabels, confidence: 0.6 };
  }
}

function applyDeterministicRules(context: string): string[] {
  const labels: string[] = [];
  const lower = context.toLowerCase();

  // Crash detection
  if (
    lower.includes("crash") ||
    lower.includes("uncaught") ||
    lower.includes("unhandled")
  ) {
    labels.push("crash");
  }

  // Performance
  if (
    lower.includes("slow") ||
    lower.includes("loading") ||
    lower.includes("timeout") ||
    lower.includes("performance")
  ) {
    labels.push("performance");
  }

  // Network
  if (
    lower.includes("network") ||
    lower.includes("api") ||
    lower.includes("request failed") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503")
  ) {
    labels.push("network");
  }

  // Authentication
  if (
    lower.includes("login") ||
    lower.includes("auth") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission")
  ) {
    labels.push("authentication");
  }

  // Mobile
  if (
    lower.includes("mobile") ||
    lower.includes("iphone") ||
    lower.includes("android") ||
    lower.includes("ios")
  ) {
    labels.push("mobile");
  }

  // UI/UX
  if (
    lower.includes("button") ||
    lower.includes("display") ||
    lower.includes("layout") ||
    lower.includes("ui") ||
    lower.includes("visual")
  ) {
    labels.push("ui");
  }

  return labels;
}
