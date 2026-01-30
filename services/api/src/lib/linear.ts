/**
 * Linear GraphQL Client
 * Handles all Linear API interactions for issue creation and syncing.
 */

const LINEAR_API_URL = "https://api.linear.app/graphql";

interface LinearConfig {
  accessToken: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: string; // backlog, unstarted, started, completed, canceled
  color: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: {
    id: string;
    name: string;
    type: string;
  };
}

interface CreateIssueInput {
  teamId: string;
  title: string;
  description?: string;
  labelIds?: string[];
  priority?: number; // 0 = none, 1 = urgent, 2 = high, 3 = normal, 4 = low
}

interface LinearResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class LinearClient {
  private accessToken: string;

  constructor(config: LinearConfig) {
    this.accessToken = config.accessToken;
  }

  private async request<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`);
    }

    const result = (await response.json()) as LinearResponse<T>;

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Linear API error: ${result.errors[0].message}`);
    }

    if (!result.data) {
      throw new Error("No data returned from Linear API");
    }

    return result.data;
  }

  /**
   * Get all teams the user has access to
   */
  async getTeams(): Promise<LinearTeam[]> {
    const query = `
      query GetTeams {
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `;

    const data = await this.request<{ teams: { nodes: LinearTeam[] } }>(query);
    return data.teams.nodes;
  }

  /**
   * Get labels for a specific team
   */
  async getLabels(teamId: string): Promise<LinearLabel[]> {
    const query = `
      query GetLabels($teamId: String!) {
        team(id: $teamId) {
          labels {
            nodes {
              id
              name
              color
            }
          }
        }
      }
    `;

    const data = await this.request<{
      team: { labels: { nodes: LinearLabel[] } };
    }>(query, { teamId });
    return data.team.labels.nodes;
  }

  /**
   * Get workflow states for a specific team
   */
  async getWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const query = `
      query GetWorkflowStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
              color
            }
          }
        }
      }
    `;

    const data = await this.request<{
      team: { states: { nodes: LinearWorkflowState[] } };
    }>(query, { teamId });
    return data.team.states.nodes;
  }

  /**
   * Create a new issue in Linear
   */
  async createIssue(input: CreateIssueInput): Promise<LinearIssue> {
    const query = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            url
            state {
              id
              name
              type
            }
          }
        }
      }
    `;

    const data = await this.request<{
      issueCreate: { success: boolean; issue: LinearIssue };
    }>(query, {
      input: {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
        labelIds: input.labelIds,
        priority: input.priority,
      },
    });

    if (!data.issueCreate.success) {
      throw new Error("Failed to create Linear issue");
    }

    return data.issueCreate.issue;
  }

  /**
   * Update an issue's state
   */
  async updateIssueState(
    issueId: string,
    stateId: string,
  ): Promise<LinearIssue> {
    const query = `
      mutation UpdateIssueState($issueId: String!, $stateId: String!) {
        issueUpdate(id: $issueId, input: { stateId: $stateId }) {
          success
          issue {
            id
            identifier
            title
            description
            url
            state {
              id
              name
              type
            }
          }
        }
      }
    `;

    const data = await this.request<{
      issueUpdate: { success: boolean; issue: LinearIssue };
    }>(query, { issueId, stateId });

    if (!data.issueUpdate.success) {
      throw new Error("Failed to update Linear issue state");
    }

    return data.issueUpdate.issue;
  }

  /**
   * Get a single issue by ID
   */
  async getIssue(issueId: string): Promise<LinearIssue | null> {
    const query = `
      query GetIssue($issueId: String!) {
        issue(id: $issueId) {
          id
          identifier
          title
          description
          url
          state {
            id
            name
            type
          }
        }
      }
    `;

    try {
      const data = await this.request<{ issue: LinearIssue | null }>(query, {
        issueId,
      });
      return data.issue;
    } catch {
      return null;
    }
  }
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeLinearOAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresIn?: number }> {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Linear OAuth credentials not configured");
  }

  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Linear OAuth error: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Map Linear issue state type to Relay interaction status
 */
export function mapLinearStateToRelayStatus(
  stateType: string,
): "new" | "triaging" | "in_progress" | "resolved" | "closed" {
  switch (stateType) {
    case "backlog":
    case "triage":
      return "triaging";
    case "unstarted":
      return "new";
    case "started":
      return "in_progress";
    case "completed":
      return "resolved";
    case "canceled":
      return "closed";
    default:
      return "new";
  }
}

/**
 * Map Relay interaction status to Linear state type
 */
export function mapRelayStatusToLinearStateType(status: string): string | null {
  switch (status) {
    case "new":
      return "unstarted";
    case "triaging":
      return "backlog";
    case "in_progress":
      return "started";
    case "resolved":
      return "completed";
    case "closed":
      return "canceled";
    default:
      return null;
  }
}
