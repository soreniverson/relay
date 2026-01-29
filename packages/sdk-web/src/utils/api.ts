// ============================================================================
// API CLIENT
// ============================================================================

const DEFAULT_ENDPOINTS: Record<string, string> = {
  'us-west': 'https://us-west.api.relay.dev',
  'eu-west': 'https://eu-west.api.relay.dev',
};

interface ApiClientConfig {
  apiKey: string;
  endpoint?: string;
  regionHint?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export class ApiClient {
  private apiKey: string;
  private endpoint: string;
  private sessionId: string | null = null;

  constructor(config: ApiClientConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || DEFAULT_ENDPOINTS[config.regionHint || 'us-west'];

    // For local development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      this.endpoint = 'http://localhost:3001';
    }
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, timeout = 30000 } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.endpoint}/trpc/${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      return data.result?.data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // tRPC-style mutation call
  private async mutation<T>(procedure: string, input: unknown): Promise<T> {
    const encodedInput = encodeURIComponent(JSON.stringify({ json: input }));
    return this.request<T>(`${procedure}?input=${encodedInput}`, {
      method: 'POST',
      body: { json: input },
    });
  }

  // tRPC-style query call
  private async query<T>(procedure: string, input?: unknown): Promise<T> {
    const params = input ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}` : '';
    return this.request<T>(`${procedure}${params}`, { method: 'GET' });
  }

  // Session management
  async createSession(data: {
    id?: string;
    userId?: string;
    device: unknown;
    appVersion?: string;
    environment: string;
    userAgent?: string;
  }): Promise<{ sessionId: string; userId: string | null }> {
    return this.mutation('ingest.session', data);
  }

  async updateSession(sessionId: string): Promise<void> {
    await this.mutation('ingest.updateSession', { sessionId, lastSeenAt: new Date() });
  }

  // User identification
  async identify(data: {
    sessionId: string;
    userId: string;
    email?: string;
    name?: string;
    traits?: Record<string, unknown>;
  }): Promise<{ userId: string }> {
    return this.mutation('ingest.identify', data);
  }

  // Create interaction
  async createInteraction(data: {
    type: string;
    source: string;
    sessionId: string;
    userId?: string;
    contentText?: string;
    content?: unknown;
    severity?: string;
    tags?: string[];
    technicalContext?: unknown;
  }): Promise<{ interactionId: string }> {
    return this.mutation('ingest.interaction', data);
  }

  // Store logs
  async storeLogs(data: {
    interactionId: string;
    console?: unknown[];
    network?: unknown[];
    errors?: unknown[];
  }): Promise<{ logsId: string }> {
    return this.mutation('ingest.logs', data);
  }

  // Media upload
  async initiateUpload(data: {
    interactionId: string;
    kind: string;
    contentType: string;
    sizeBytes: number;
    filename?: string;
  }): Promise<{ mediaId: string; uploadUrl: string }> {
    return this.mutation('ingest.initiateUpload', data);
  }

  async completeUpload(mediaId: string): Promise<{ success: boolean }> {
    return this.mutation('ingest.completeUpload', { mediaId });
  }

  // Replay
  async startReplay(sessionId: string, interactionId?: string): Promise<{ replayId: string }> {
    return this.mutation('ingest.startReplay', { sessionId, interactionId });
  }

  async sendReplayChunk(data: {
    replayId: string;
    chunkIndex: number;
    events: unknown[];
    startTime: number;
    endTime: number;
  }): Promise<{ uploadUrl: string }> {
    return this.mutation('ingest.replayChunk', data);
  }

  async endReplay(replayId: string, totalEventCount: number): Promise<{ success: boolean }> {
    return this.mutation('ingest.endReplay', { replayId, totalEventCount });
  }

  // Track event
  async track(sessionId: string, event: string, properties?: Record<string, unknown>): Promise<void> {
    await this.mutation('ingest.track', { sessionId, event, properties });
  }

  // Feedback
  async getFeedbackItems(sessionId?: string): Promise<{ data: unknown[] }> {
    return this.query('feedback.publicList', { sessionId });
  }

  async voteFeedback(feedbackItemId: string, sessionId: string, userId?: string): Promise<void> {
    await this.mutation('feedback.vote', { feedbackItemId, sessionId, userId });
  }

  async unvoteFeedback(feedbackItemId: string, sessionId: string): Promise<void> {
    await this.mutation('feedback.unvote', { feedbackItemId, sessionId });
  }

  // Surveys
  async getActiveSurveys(data: {
    sessionId: string;
    userId?: string;
    url?: string;
    traits?: Record<string, unknown>;
  }): Promise<unknown[]> {
    return this.query('surveys.getActiveSurveys', data);
  }

  async submitSurveyResponse(data: {
    surveyId: string;
    sessionId: string;
    responses: Record<string, unknown>;
  }): Promise<{ interactionId: string }> {
    return this.mutation('surveys.respond', data);
  }

  // Chat
  async startConversation(data: {
    sessionId: string;
    userId?: string;
    subject?: string;
    message: string;
  }): Promise<{ conversationId: string; messageId: string }> {
    return this.mutation('conversations.start', data);
  }

  async sendMessage(conversationId: string, body: string): Promise<{ messageId: string }> {
    return this.mutation('conversations.sendUserMessage', { conversationId, body });
  }

  async getConversations(sessionId: string): Promise<unknown[]> {
    return this.query('conversations.getUserConversations', { sessionId });
  }

  async getMessages(conversationId: string): Promise<{ messages: unknown[]; hasMore: boolean }> {
    return this.query('conversations.getMessages', { conversationId });
  }

  async markMessagesRead(conversationId: string): Promise<void> {
    await this.mutation('conversations.markRead', { conversationId });
  }

  // Roadmap
  async getPublicRoadmap(): Promise<{ data: unknown[] }> {
    return this.query('roadmap.publicList', {});
  }
}
