/**
 * OpenAI Client Library
 * Handles AI-powered features: summarization, tagging, sentiment analysis, suggestions
 */

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
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

export interface SummarizeResult {
  summary: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  category:
    | "bug"
    | "feature_request"
    | "question"
    | "praise"
    | "complaint"
    | "other";
}

export interface SuggestRepliesResult {
  suggestions: string[];
}

class OpenAIClient {
  private apiKey: string | undefined;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async request(
    messages: OpenAIMessage[],
    maxTokens = 1000,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    return data.choices[0]?.message?.content || "";
  }

  /**
   * Summarize an interaction and extract metadata
   */
  async summarizeInteraction(input: {
    title?: string;
    description?: string;
    type: string;
    url?: string;
    browser?: string;
    error?: string;
    userEmail?: string;
  }): Promise<SummarizeResult> {
    const systemPrompt = `You are an AI assistant that analyzes user feedback, bug reports, and support requests.
Your job is to:
1. Summarize the content in 1-2 concise sentences
2. Extract relevant tags (max 5, lowercase, hyphenated)
3. Determine sentiment (positive, neutral, negative, or frustrated)
4. Categorize the content (bug, feature_request, question, praise, complaint, or other)

Respond in JSON format exactly like this:
{
  "summary": "Brief 1-2 sentence summary",
  "tags": ["tag-one", "tag-two"],
  "sentiment": "neutral",
  "category": "bug"
}`;

    const userContent = `
Type: ${input.type}
${input.title ? `Title: ${input.title}` : ""}
${input.description ? `Description: ${input.description}` : ""}
${input.url ? `Page URL: ${input.url}` : ""}
${input.browser ? `Browser: ${input.browser}` : ""}
${input.error ? `Error: ${input.error}` : ""}
${input.userEmail ? `User: ${input.userEmail}` : ""}
`.trim();

    const response = await this.request([
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]);

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const result = JSON.parse(jsonMatch[0]);
      return {
        summary: result.summary || "Unable to generate summary",
        tags: Array.isArray(result.tags) ? result.tags.slice(0, 5) : [],
        sentiment: ["positive", "neutral", "negative", "frustrated"].includes(
          result.sentiment,
        )
          ? result.sentiment
          : "neutral",
        category: [
          "bug",
          "feature_request",
          "question",
          "praise",
          "complaint",
          "other",
        ].includes(result.category)
          ? result.category
          : "other",
      };
    } catch (error) {
      // Return defaults if parsing fails
      return {
        summary: "Unable to generate summary",
        tags: [],
        sentiment: "neutral",
        category: "other",
      };
    }
  }

  /**
   * Suggest replies for a conversation
   */
  async suggestReplies(input: {
    projectName: string;
    conversationHistory: Array<{ role: "user" | "agent"; content: string }>;
    relevantArticles?: Array<{ title: string; excerpt: string }>;
  }): Promise<SuggestRepliesResult> {
    const systemPrompt = `You are a helpful support agent for ${input.projectName}.
Based on the conversation history and any relevant knowledge base articles, suggest 2-3 professional and helpful reply options.

Keep replies:
- Concise (1-3 sentences each)
- Professional but friendly
- Actionable when possible

Respond in JSON format:
{
  "suggestions": [
    "First suggested reply",
    "Second suggested reply",
    "Third suggested reply"
  ]
}`;

    let userContent = "Conversation history:\n";
    for (const msg of input.conversationHistory) {
      userContent += `${msg.role === "user" ? "Customer" : "Agent"}: ${msg.content}\n`;
    }

    if (input.relevantArticles && input.relevantArticles.length > 0) {
      userContent += "\nRelevant knowledge base articles:\n";
      for (const article of input.relevantArticles) {
        userContent += `- ${article.title}: ${article.excerpt}\n`;
      }
    }

    userContent += "\nGenerate helpful reply suggestions for the agent.";

    const response = await this.request([
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const result = JSON.parse(jsonMatch[0]);
      return {
        suggestions: Array.isArray(result.suggestions)
          ? result.suggestions.slice(0, 3)
          : [],
      };
    } catch {
      return { suggestions: [] };
    }
  }

  /**
   * Find similar content for duplicate detection
   */
  async findSimilarContent(input: {
    newContent: string;
    existingItems: Array<{ id: string; title: string; description?: string }>;
  }): Promise<Array<{ id: string; similarity: number; reason: string }>> {
    if (input.existingItems.length === 0) {
      return [];
    }

    const systemPrompt = `You are analyzing content for potential duplicates.
Compare the new content against existing items and identify any that seem to be about the same issue.

Respond in JSON format:
{
  "matches": [
    { "id": "item-id", "similarity": 0.85, "reason": "Brief explanation of why they're similar" }
  ]
}

Only include items with similarity > 0.6. Similarity should be 0-1 where 1 is identical.`;

    let userContent = `New content:\n${input.newContent}\n\nExisting items:\n`;
    for (const item of input.existingItems.slice(0, 10)) {
      userContent += `- ID: ${item.id} | ${item.title}${item.description ? ` | ${item.description.slice(0, 100)}` : ""}\n`;
    }

    const response = await this.request([
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }
      const result = JSON.parse(jsonMatch[0]);
      return Array.isArray(result.matches)
        ? result.matches.filter(
            (m: { similarity: number }) => m.similarity > 0.6,
          )
        : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate article content from a topic
   */
  async generateArticleContent(input: {
    topic: string;
    projectName: string;
    existingContent?: string;
  }): Promise<{ title: string; content: string }> {
    const systemPrompt = `You are a technical writer creating help documentation for ${input.projectName}.
Write clear, helpful documentation that users can easily understand.

Use markdown formatting:
- Use ## for main sections
- Use bullet points for lists
- Use code blocks for any code examples
- Keep paragraphs concise

Respond in JSON format:
{
  "title": "Article Title",
  "content": "Full markdown content..."
}`;

    const userContent = input.existingContent
      ? `Improve this article about "${input.topic}":\n\n${input.existingContent}`
      : `Write a help article about: ${input.topic}`;

    const response = await this.request(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      2000,
    );

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found");
      }
      const result = JSON.parse(jsonMatch[0]);
      return {
        title: result.title || input.topic,
        content: result.content || "",
      };
    } catch {
      return {
        title: input.topic,
        content: "",
      };
    }
  }
}

// Export singleton instance
export const openai = new OpenAIClient();
