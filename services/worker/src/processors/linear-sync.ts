import { Job } from 'bullmq';
import { prisma } from '../index.js';

interface LinearSyncJob {
  type: 'create' | 'update' | 'sync';
  interactionId?: string;
  projectId: string;
  issueData?: {
    title: string;
    description: string;
    priority?: number;
    labelIds?: string[];
  };
}

interface LinearApiResponse {
  errors?: Array<{ message: string }>;
  data?: {
    issueCreate?: { issue: { identifier: string; url: string; id: string } };
    issueUpdate?: { issue: { identifier: string; url: string; id: string } };
    issues?: { nodes: Array<{ id: string; identifier: string; title: string; state: { name: string; type: string } }> };
  };
}

export async function linearSyncProcessor(job: Job<LinearSyncJob>) {
  const { type, interactionId, projectId, issueData } = job.data;

  console.log(`Processing Linear sync: ${type} for project ${projectId}`);

  // Get integration config
  const integration = await prisma.integration.findUnique({
    where: {
      projectId_provider: {
        projectId,
        provider: 'linear',
      },
    },
  });

  if (!integration || !integration.enabled) {
    return { skipped: true, reason: 'integration_disabled' };
  }

  const config = integration.config as Record<string, unknown>;
  const accessToken = config.accessToken as string;

  if (!accessToken) {
    throw new Error('Linear access token not configured');
  }

  switch (type) {
    case 'create':
      return await createLinearIssue(
        accessToken,
        config,
        interactionId!,
        issueData!
      );
    case 'update':
      return await updateLinearIssue(accessToken, interactionId!);
    case 'sync':
      return await syncLinearIssues(accessToken, projectId, config);
    default:
      throw new Error(`Unknown sync type: ${type}`);
  }
}

async function createLinearIssue(
  accessToken: string,
  config: Record<string, unknown>,
  interactionId: string,
  issueData: {
    title: string;
    description: string;
    priority?: number;
    labelIds?: string[];
  }
) {
  const teamId = config.teamId as string;
  const defaultLabelId = config.defaultLabelId as string | undefined;

  if (!teamId) {
    throw new Error('Linear team ID not configured');
  }

  // Fetch interaction for additional context
  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
    include: { media: { take: 1 } },
  });

  if (!interaction) {
    throw new Error(`Interaction ${interactionId} not found`);
  }

  // Build description with context
  let description = issueData.description;

  if (interaction.aiSummary) {
    description = `**AI Summary:** ${interaction.aiSummary}\n\n${description}`;
  }

  // Add screenshot if available
  const screenshot = interaction.media.find((m) => m.kind === 'screenshot');
  if (screenshot) {
    description += `\n\n**Screenshot:** ${screenshot.url}`;
  }

  // Add link back to Relay
  const relayUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  description += `\n\n---\n[View in Relay](${relayUrl}/dashboard/inbox/${interactionId})`;

  // Create issue via Linear API
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken,
    },
    body: JSON.stringify({
      query: `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              url
            }
          }
        }
      `,
      variables: {
        input: {
          teamId,
          title: issueData.title,
          description,
          priority: issueData.priority || 0,
          labelIds: defaultLabelId
            ? [...(issueData.labelIds || []), defaultLabelId]
            : issueData.labelIds,
        },
      },
    }),
  });

  const result = await response.json() as LinearApiResponse;

  if (result.errors) {
    throw new Error(`Linear API error: ${JSON.stringify(result.errors)}`);
  }

  const issue = result.data!.issueCreate!.issue;

  // Update interaction with linked issue
  await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      linkedIssueProvider: 'linear',
      linkedIssueId: issue.identifier,
      linkedIssueUrl: issue.url,
    },
  });

  // Create integration link
  await prisma.integrationLink.create({
    data: {
      projectId: interaction.projectId,
      provider: 'linear',
      externalId: issue.id,
      internalType: 'interaction',
      internalId: interactionId,
      externalUrl: issue.url,
    },
  });

  console.log(`Created Linear issue ${issue.identifier}`);

  return { success: true, issueId: issue.id, identifier: issue.identifier };
}

async function updateLinearIssue(accessToken: string, interactionId: string) {
  // Fetch interaction with linked issue
  const interaction = await prisma.interaction.findUnique({
    where: { id: interactionId },
    include: {
      integrationLinks: {
        where: { provider: 'linear' },
      },
    },
  });

  if (!interaction || interaction.integrationLinks.length === 0) {
    return { skipped: true, reason: 'no_linked_issue' };
  }

  const link = interaction.integrationLinks[0];

  // Map Relay status to Linear state
  const stateMap: Record<string, string> = {
    new: 'backlog',
    triaging: 'triage',
    in_progress: 'started',
    resolved: 'completed',
    closed: 'canceled',
  };

  const state = stateMap[interaction.status] || 'backlog';

  // Update issue state
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken,
    },
    body: JSON.stringify({
      query: `
        mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
          }
        }
      `,
      variables: {
        id: link.externalId,
        input: {
          stateId: state, // Note: This should be actual state ID, simplified here
        },
      },
    }),
  });

  const result = await response.json() as LinearApiResponse;

  if (result.errors) {
    console.error('Linear update error:', result.errors);
    return { success: false, errors: result.errors };
  }

  return { success: true };
}

async function syncLinearIssues(
  accessToken: string,
  projectId: string,
  config: Record<string, unknown>
) {
  // Get all linked issues for this project
  const links = await prisma.integrationLink.findMany({
    where: {
      projectId,
      provider: 'linear',
      internalType: 'interaction',
    },
  });

  if (links.length === 0) {
    return { skipped: true, reason: 'no_linked_issues' };
  }

  // Fetch issue states from Linear
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken,
    },
    body: JSON.stringify({
      query: `
        query Issues($ids: [String!]!) {
          issues(filter: { id: { in: $ids } }) {
            nodes {
              id
              state {
                name
                type
              }
            }
          }
        }
      `,
      variables: {
        ids: links.map((l) => l.externalId),
      },
    }),
  });

  const result = await response.json() as LinearApiResponse;

  if (result.errors) {
    throw new Error(`Linear API error: ${JSON.stringify(result.errors)}`);
  }

  // Map Linear states back to Relay status
  const linearToRelayStatus: Record<string, string> = {
    backlog: 'new',
    triage: 'triaging',
    started: 'in_progress',
    completed: 'resolved',
    canceled: 'closed',
  };

  let updated = 0;

  for (const issue of result.data!.issues!.nodes) {
    const link = links.find((l) => l.externalId === issue.id);
    if (!link) continue;

    const relayStatus = linearToRelayStatus[issue.state.type] || 'new';

    await prisma.interaction.update({
      where: { id: link.internalId },
      data: { status: relayStatus as any },
    });

    updated++;
  }

  // Update last sync time
  await prisma.integration.update({
    where: {
      projectId_provider: {
        projectId,
        provider: 'linear',
      },
    },
    data: { lastSyncAt: new Date() },
  });

  return { success: true, updated };
}
