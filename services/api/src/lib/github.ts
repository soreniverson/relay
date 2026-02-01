// ============================================================================
// GITHUB API CLIENT
// Uses GitHub REST API with OAuth access tokens
// ============================================================================

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_OAUTH_URL = "https://github.com/login/oauth";

export interface GitHubClientConfig {
  accessToken: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface CreateGitHubIssueInput {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

/**
 * Exchange OAuth code for access token
 */
interface GitHubOAuthResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeGitHubOAuthCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; tokenType: string; scope: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth credentials not configured");
  }

  const response = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth error: ${response.status}`);
  }

  const data = (await response.json()) as GitHubOAuthResponse;

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    accessToken: data.access_token || "",
    tokenType: data.token_type || "bearer",
    scope: data.scope || "",
  };
}

export class GitHubClient {
  private accessToken: string;

  constructor(config: GitHubClientConfig) {
    this.accessToken = config.accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${GITHUB_API_URL}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Relay-Integration",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `GitHub API error: ${response.status}`;
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

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get the authenticated user
   */
  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("GET", "/user");
  }

  /**
   * Get repositories the user has access to
   */
  async getRepositories(options: {
    visibility?: "all" | "public" | "private";
    sort?: "created" | "updated" | "pushed" | "full_name";
    per_page?: number;
  } = {}): Promise<GitHubRepository[]> {
    const { visibility = "all", sort = "updated", per_page = 100 } = options;
    const query = new URLSearchParams({
      visibility,
      sort,
      per_page: String(per_page),
    });
    return this.request<GitHubRepository[]>("GET", `/user/repos?${query}`);
  }

  /**
   * Get a single repository
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>("GET", `/repos/${owner}/${repo}`);
  }

  /**
   * Get labels for a repository
   */
  async getLabels(owner: string, repo: string): Promise<GitHubLabel[]> {
    return this.request<GitHubLabel[]>("GET", `/repos/${owner}/${repo}/labels`);
  }

  /**
   * Create a new issue
   */
  async createIssue(input: CreateGitHubIssueInput): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      "POST",
      `/repos/${input.owner}/${input.repo}/issues`,
      {
        title: input.title,
        body: input.body,
        labels: input.labels,
        assignees: input.assignees,
      }
    );
  }

  /**
   * Get an issue by number
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue | null> {
    try {
      return await this.request<GitHubIssue>(
        "GET",
        `/repos/${owner}/${repo}/issues/${issueNumber}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search issues
   */
  async searchIssues(
    query: string,
    options: { per_page?: number } = {}
  ): Promise<{ items: GitHubIssue[]; total_count: number }> {
    const { per_page = 30 } = options;
    const searchQuery = encodeURIComponent(query);
    return this.request<{ items: GitHubIssue[]; total_count: number }>(
      "GET",
      `/search/issues?q=${searchQuery}&per_page=${per_page}`
    );
  }

  /**
   * Add a comment to an issue
   */
  async addIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    await this.request(
      "POST",
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      { body }
    );
  }

  /**
   * Update an issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    data: {
      title?: string;
      body?: string;
      state?: "open" | "closed";
      labels?: string[];
      assignees?: string[];
    }
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      "PATCH",
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      data
    );
  }
}

/**
 * Map GitHub issue state to Relay interaction status
 */
export function mapGitHubStateToRelayStatus(
  state: "open" | "closed"
): "new" | "triaging" | "in_progress" | "resolved" | "closed" {
  switch (state) {
    case "open":
      return "in_progress";
    case "closed":
      return "resolved";
    default:
      return "in_progress";
  }
}
