// ============================================================================
// JIRA API CLIENT
// Uses Jira Cloud REST API with basic auth (email + API token)
// ============================================================================

export interface JiraClientConfig {
  siteUrl: string; // e.g., https://yourcompany.atlassian.net
  email: string;
  apiToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrls: Record<string, string>;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls: Record<string, string>;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      id: string;
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    issuetype: {
      id: string;
      name: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    assignee?: JiraUser;
    reporter?: JiraUser;
  };
}

export interface CreateJiraIssueInput {
  projectKey: string;
  issueTypeId: string;
  summary: string;
  description?: string;
  priority?: string;
  labels?: string[];
}

interface JiraErrorResponse {
  errorMessages?: string[];
  errors?: Record<string, string>;
}

export class JiraClient {
  private siteUrl: string;
  private authHeader: string;

  constructor(config: JiraClientConfig) {
    this.siteUrl = config.siteUrl.replace(/\/$/, ""); // Remove trailing slash
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.siteUrl}/rest/api/3${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `Jira API error: ${response.status}`;
      try {
        const errorBody = (await response.json()) as JiraErrorResponse;
        if (errorBody.errorMessages?.length) {
          errorMessage = errorBody.errorMessages.join(", ");
        } else if (errorBody.errors) {
          errorMessage = Object.values(errorBody.errors).join(", ");
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
   * Verify the connection by fetching the current user
   */
  async verifyConnection(): Promise<{ accountId: string; displayName: string }> {
    const user = await this.request<JiraUser>("GET", "/myself");
    return {
      accountId: user.accountId,
      displayName: user.displayName,
    };
  }

  /**
   * Get all projects the user has access to
   */
  async getProjects(): Promise<JiraProject[]> {
    const response = await this.request<{ values: JiraProject[] }>(
      "GET",
      "/project/search?expand=description"
    );
    return response.values;
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const response = await this.request<{ issueTypes: JiraIssueType[] }>(
      "GET",
      `/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`
    );

    // Extract issue types from the response
    const project = (response as any).projects?.[0];
    return project?.issuetypes || [];
  }

  /**
   * Get issue types using the new metadata endpoint (Jira Cloud)
   */
  async getProjectIssueTypes(projectId: string): Promise<JiraIssueType[]> {
    const response = await this.request<JiraIssueType[]>(
      "GET",
      `/project/${projectId}/statuses`
    );
    return response;
  }

  /**
   * Create a new issue
   */
  async createIssue(input: CreateJiraIssueInput): Promise<JiraIssue> {
    // Build the Atlassian Document Format for description
    const descriptionAdf = input.description
      ? {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: input.description,
                },
              ],
            },
          ],
        }
      : undefined;

    const issueData: Record<string, unknown> = {
      fields: {
        project: {
          key: input.projectKey,
        },
        summary: input.summary,
        issuetype: {
          id: input.issueTypeId,
        },
        ...(descriptionAdf && { description: descriptionAdf }),
        ...(input.priority && {
          priority: {
            name: input.priority,
          },
        }),
        ...(input.labels?.length && { labels: input.labels }),
      },
    };

    const response = await this.request<{ id: string; key: string; self: string }>(
      "POST",
      "/issue",
      issueData
    );

    return {
      id: response.id,
      key: response.key,
      self: response.self,
      fields: {
        summary: input.summary,
        description: input.description,
        status: { id: "", name: "Open", statusCategory: { key: "new", name: "To Do" } },
        issuetype: { id: input.issueTypeId, name: "" },
      },
    };
  }

  /**
   * Get an issue by ID or key
   */
  async getIssue(issueIdOrKey: string): Promise<JiraIssue | null> {
    try {
      return await this.request<JiraIssue>(
        "GET",
        `/issue/${issueIdOrKey}?fields=summary,description,status,issuetype,priority,assignee,reporter`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get the browse URL for an issue
   */
  getIssueUrl(issueKey: string): string {
    return `${this.siteUrl}/browse/${issueKey}`;
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(
    jql: string,
    options: { maxResults?: number; startAt?: number } = {}
  ): Promise<{ issues: JiraIssue[]; total: number }> {
    const { maxResults = 50, startAt = 0 } = options;
    const response = await this.request<{
      issues: JiraIssue[];
      total: number;
      maxResults: number;
      startAt: number;
    }>("POST", "/search", {
      jql,
      maxResults,
      startAt,
      fields: ["summary", "description", "status", "issuetype", "priority", "assignee"],
    });

    return {
      issues: response.issues,
      total: response.total,
    };
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueIdOrKey: string, body: string): Promise<void> {
    const commentAdf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: body,
            },
          ],
        },
      ],
    };

    await this.request("POST", `/issue/${issueIdOrKey}/comment`, {
      body: commentAdf,
    });
  }

  /**
   * Get priorities
   */
  async getPriorities(): Promise<Array<{ id: string; name: string }>> {
    return this.request<Array<{ id: string; name: string }>>("GET", "/priority");
  }
}

/**
 * Map Jira status category to Relay interaction status
 */
export function mapJiraStatusToRelayStatus(
  statusCategoryKey: string
): "new" | "triaging" | "in_progress" | "resolved" | "closed" {
  switch (statusCategoryKey) {
    case "new":
    case "undefined":
      return "new";
    case "indeterminate":
      return "in_progress";
    case "done":
      return "resolved";
    default:
      return "in_progress";
  }
}
