# Phase 4 Implementation Plan: Growth Features

## Summary

Phase 4 focuses on features that drive adoption and retention: extended integrations, team collaboration, analytics, AI bot, and enhanced tours/announcements.

**Key Findings from Exploration:**

- Integrations router has Linear/Slack complete; Jira/GitHub/Discord are stubbed
- Team roles exist in schema but NO permission enforcement middleware
- Analytics has no router or dashboard - needs full build
- Tours API is complete but SDK has no rendering
- Announcements API is complete but dashboard uses mock data

---

## Priority Order

| #   | Feature                 | Effort   | Impact   | Dependencies          |
| --- | ----------------------- | -------- | -------- | --------------------- |
| 1   | Announcements Dashboard | 2-3 days | High     | None - API ready      |
| 2   | Team Permissions        | 3-4 days | Critical | None - foundation     |
| 3   | Analytics Dashboard     | 4-5 days | High     | None                  |
| 4   | Tour SDK Rendering      | 3-4 days | High     | None                  |
| 5   | Jira Integration        | 4-5 days | Medium   | None                  |
| 6   | GitHub Integration      | 3-4 days | Medium   | None                  |
| 7   | AI Bot (Kai)            | 5-7 days | High     | Knowledge Base (done) |
| 8   | Discord Integration     | 1-2 days | Low      | None                  |

---

## 1. Announcements Dashboard Integration

**Current State:** API complete, dashboard uses mock data

**Files to Update:**

- `apps/web/src/app/dashboard/announcements/page.tsx` - Wire to API

**Implementation:**

```
1. Replace mock data with tRPC queries:
   - trpc.announcements.list.useQuery({ projectId })
   - trpc.announcements.create.useMutation()
   - trpc.announcements.update.useMutation()
   - trpc.announcements.delete.useMutation()
   - trpc.announcements.toggle.useMutation()

2. Add form validation for create/edit:
   - Title, content (markdown), type
   - Start/end date pickers
   - Targeting rules builder

3. SDK Integration:
   - Call getActiveAnnouncements on widget init
   - Render by type: banner (sticky), modal (centered), slideout (side)
   - Track dismiss and clicks
```

**Verification:**

- Create announcement in dashboard
- Verify it shows in SDK widget
- Dismiss and verify showOnce works

---

## 2. Team Permissions & Middleware

**Current State:** `ProjectMembership` model with roles exists, no enforcement

**Files to Create/Update:**

- `services/api/src/middleware/permissions.ts` - **New** permission checks
- `services/api/src/routers/auth.ts` - Add invite/role management
- `apps/web/src/app/dashboard/settings/page.tsx` - Wire team tab

**Implementation:**

### 2.1 Permission Middleware

```typescript
// services/api/src/middleware/permissions.ts
import { TRPCError } from "@trpc/server";

type Role = "owner" | "admin" | "agent" | "viewer";

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  agent: 2,
  viewer: 1,
};

export function requireRole(minimumRole: Role) {
  return async ({ ctx, next }) => {
    const membership = ctx.membership; // Set by projectProcedure
    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not a project member",
      });
    }
    if (roleHierarchy[membership.role] < roleHierarchy[minimumRole]) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires ${minimumRole} role`,
      });
    }
    return next();
  };
}
```

### 2.2 Role-Protected Procedures

```typescript
// Apply to sensitive mutations
const adminProcedure = projectProcedure.use(requireRole("admin"));
const ownerProcedure = projectProcedure.use(requireRole("owner"));

// Example usage:
delete: adminProcedure.input(...).mutation(...)
transferOwnership: ownerProcedure.input(...).mutation(...)
```

### 2.3 Team Management Endpoints

```typescript
// In auth.ts
inviteUser: adminProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["admin", "agent", "viewer"]),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Check if user exists
    // 2. If not, create pending invitation record
    // 3. Send invite email with magic link
    // 4. On accept, create ProjectMembership
  }),

updateMemberRole: adminProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["admin", "agent", "viewer"]),
  }))
  .mutation(...),

removeMember: adminProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
  }))
  .mutation(...),

listMembers: projectProcedure
  .input(z.object({ projectId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    return ctx.prisma.projectMembership.findMany({
      where: { projectId: input.projectId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }),
```

### 2.4 Dashboard Team Tab

```
1. Fetch real members via trpc.auth.listMembers
2. Show role badges and allow admins to change roles
3. Invite form with email + role selector
4. Remove member with confirmation
5. Show pending invitations
```

**Database Addition:**

```prisma
model ProjectInvitation {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  email     String
  role      UserRole
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([email])
}
```

---

## 3. Analytics Dashboard

**Current State:** No analytics router or page

**Files to Create:**

- `services/api/src/routers/analytics.ts` - **New** analytics queries
- `apps/web/src/app/dashboard/analytics/page.tsx` - **New** dashboard

**Implementation:**

### 3.1 Analytics Router

```typescript
// services/api/src/routers/analytics.ts
export const analyticsRouter = router({
  getInteractionVolume: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        period: z.enum(["7d", "30d", "90d"]),
        groupBy: z.enum(["day", "week"]).default("day"),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Group interactions by date
      // Return: [{ date, count, byType: { bug, feedback, chat } }]
    }),

  getResponseMetrics: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        period: z.enum(["7d", "30d", "90d"]),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Calculate avg time from created to first response
      // Calculate avg time to resolution
      // Return: { avgFirstResponse, avgResolution, byStatus }
    }),

  getSurveyStats: projectProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // For each survey: responses, completion rate, avg score (NPS/rating)
      // Return: [{ surveyId, name, responses, completionRate, avgScore }]
    }),

  getTopFeedback: projectProcedure
    .input(
      z.object({ projectId: z.string().uuid(), limit: z.number().default(10) }),
    )
    .query(async ({ input, ctx }) => {
      // Order by voteCount desc
      // Return: [{ id, title, voteCount, status }]
    }),

  getSatisfactionTrend: projectProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        period: z.enum(["30d", "90d"]),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Aggregate sentiment scores from AI summaries over time
      // Return: [{ date, avgSentiment, positive, neutral, negative }]
    }),
});
```

### 3.2 Analytics Dashboard Page

```
Layout:
┌─────────────────────────────────────────────────────────────┐
│ Analytics                              [7d] [30d] [90d]     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │ Total       │ │ Avg First   │ │ Resolution  │ │ NPS     │ │
│ │ Interactions│ │ Response    │ │ Rate        │ │ Score   │ │
│ │ 1,234       │ │ 2.4 hrs     │ │ 78%         │ │ 42      │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Interaction Volume                                          │
│ ▁▂▄▆█▇▅▃▂▄▆█▇▅▃▂▁▂▄▆█▇▅▃▂▄▆ (Line chart)                   │
├─────────────────────────────────────────────────────────────┤
│ By Type (Pie)      │ Top Feedback Items                     │
│   ● Bugs 45%       │ 1. Dark mode (128 votes)               │
│   ● Feedback 35%   │ 2. Mobile app (96 votes)               │
│   ● Chat 20%       │ 3. Export to CSV (72 votes)            │
└─────────────────────────────────────────────────────────────┘
```

**Libraries:**

- `recharts` for charts (already in dependencies)

---

## 4. Tour SDK Rendering

**Current State:** API complete with progress tracking, SDK has no UI

**Files to Create/Update:**

- `packages/sdk-web/src/tours/TourManager.ts` - **New** tour state management
- `packages/sdk-web/src/ui/components/tour/` - **New** tour UI components
- `packages/sdk-web/src/index.ts` - Expose tour methods

**Implementation:**

### 4.1 Tour Manager

```typescript
// packages/sdk-web/src/tours/TourManager.ts
export class TourManager {
  private activeTour: Tour | null = null;
  private currentStep: number = 0;
  private overlay: HTMLElement | null = null;

  async start(tourId: string): Promise<void> {
    // 1. Fetch tour from API
    // 2. Create progress record
    // 3. Show first step
  }

  next(): void {
    // Advance to next step, or complete if last
  }

  prev(): void {
    // Go back one step
  }

  skip(): void {
    // Dismiss tour, record in progress
  }

  private renderStep(step: TourStep): void {
    // 1. Find target element via selector
    // 2. Position tooltip/modal relative to element
    // 3. Add highlight/beacon if needed
    // 4. Attach click handlers for advance
  }

  private createOverlay(): void {
    // Semi-transparent overlay with cutout for highlighted element
  }
}
```

### 4.2 Tour UI Components

```
Step Types:
- Tooltip: Positioned relative to element, arrow pointing
- Modal: Centered overlay, for welcome/summary steps
- Highlight: Pulsing border around element
- Beacon: Animated dot to draw attention

Components:
- TourTooltip.tsx - Positioned tooltip with title, content, buttons
- TourModal.tsx - Centered modal for intro/outro
- TourHighlight.tsx - CSS highlight effect
- TourBeacon.tsx - Animated attention grabber
- TourOverlay.tsx - Backdrop with element cutout
```

### 4.3 SDK Methods

```typescript
// Expose on Relay object
Relay.tours = {
  start: (tourId: string) => tourManager.start(tourId),
  next: () => tourManager.next(),
  prev: () => tourManager.prev(),
  skip: () => tourManager.skip(),
  isActive: () => tourManager.isActive(),
};
```

---

## 5. Jira Integration

**Current State:** Stub exists with `NOT_IMPLEMENTED` error

**Files to Update:**

- `services/api/src/routers/integrations.ts` - Implement Jira methods
- `services/api/src/lib/jira.ts` - **New** Jira REST client

**Implementation:**

### 5.1 Jira OAuth Flow

```
1. Register OAuth app at developer.atlassian.com
2. Scopes: read:jira-work, write:jira-work, read:me
3. Store access_token and refresh_token in Integration.config
4. Implement token refresh on 401
```

### 5.2 Jira Client

```typescript
// services/api/src/lib/jira.ts
export class JiraClient {
  constructor(
    private cloudId: string,
    private accessToken: string,
  ) {}

  async getProjects(): Promise<JiraProject[]> {
    // GET /rest/api/3/project/search
  }

  async getIssueTypes(projectKey: string): Promise<IssueType[]> {
    // GET /rest/api/3/project/{projectKey}/statuses
  }

  async createIssue(params: CreateIssueParams): Promise<JiraIssue> {
    // POST /rest/api/3/issue
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    // GET /rest/api/3/issue/{issueKey}
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    // POST /rest/api/3/issue/{issueKey}/transitions
  }
}
```

### 5.3 Sync Logic

```
Relay → Jira:
- Create issue from interaction
- Include link back to Relay
- Map severity to priority

Jira → Relay (webhook):
- Issue status change → Update interaction status
- Issue resolved → Close interaction
```

**Environment Variables:**

```
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...
```

---

## 6. GitHub Integration

**Current State:** Stub exists

**Files to Update:**

- `services/api/src/routers/integrations.ts` - Implement GitHub methods
- `services/api/src/lib/github.ts` - **New** GitHub client (use Octokit)

**Implementation:**

```
1. GitHub App or OAuth App registration
2. Scopes: repo, issues:write
3. Create issues from interactions
4. Link PRs to feedback items
5. Webhook for issue/PR updates
```

---

## 7. AI Bot (Kai) - V1

**Current State:** Knowledge base exists, no RAG pipeline

**Files to Create:**

- `services/api/src/lib/embeddings.ts` - Vector embedding generation
- `services/api/src/routers/bot.ts` - Bot query endpoint
- Database: Add pgvector extension and embedding column

**Implementation:**

### 7.1 Embeddings

```typescript
// On article create/update:
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: article.content,
});
await prisma.article.update({
  where: { id: article.id },
  data: { embedding: embedding.data[0].embedding },
});
```

### 7.2 RAG Query

```typescript
// services/api/src/routers/bot.ts
answer: publicProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    question: z.string(),
    sessionId: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Generate embedding for question
    // 2. Vector similarity search against articles
    // 3. Build context from top 3 matches
    // 4. Call OpenAI with context + question
    // 5. Return answer with confidence score
    // 6. If confidence < threshold, suggest human handoff
  }),
```

### 7.3 Database

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add column to Article
ALTER TABLE "Article" ADD COLUMN embedding vector(1536);
CREATE INDEX ON "Article" USING ivfflat (embedding vector_cosine_ops);
```

---

## 8. Discord Integration

**Current State:** Enum exists, no implementation

**Files to Update:**

- `services/api/src/routers/integrations.ts` - Add Discord webhook
- `services/api/src/lib/discord.ts` - **New** Discord client

**Implementation:**

```
Simple webhook integration (no bot):
1. Store webhook URL in Integration.config
2. POST rich embeds on events:
   - New bug report
   - High severity interaction
   - New feedback
3. Format: Title, description, severity badge, link to Relay
```

---

## File Summary

| Action | File                                                              |
| ------ | ----------------------------------------------------------------- |
| Update | `apps/web/src/app/dashboard/announcements/page.tsx` - Wire to API |
| Create | `services/api/src/middleware/permissions.ts` - Role enforcement   |
| Update | `services/api/src/routers/auth.ts` - Team management              |
| Update | `apps/web/src/app/dashboard/settings/page.tsx` - Team tab         |
| Create | `services/api/src/routers/analytics.ts` - Analytics queries       |
| Create | `apps/web/src/app/dashboard/analytics/page.tsx` - Dashboard       |
| Create | `packages/sdk-web/src/tours/TourManager.ts` - Tour state          |
| Create | `packages/sdk-web/src/ui/components/tour/*.tsx` - Tour UI         |
| Update | `packages/sdk-web/src/index.ts` - Tour methods                    |
| Create | `services/api/src/lib/jira.ts` - Jira client                      |
| Create | `services/api/src/lib/github.ts` - GitHub client                  |
| Update | `services/api/src/routers/integrations.ts` - Jira/GitHub/Discord  |
| Create | `services/api/src/lib/embeddings.ts` - Vector embeddings          |
| Create | `services/api/src/routers/bot.ts` - AI bot endpoint               |
| Create | `services/api/src/lib/discord.ts` - Discord webhooks              |

---

## Environment Variables (New)

```
# Jira
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...

# GitHub
GITHUB_APP_ID=...
GITHUB_PRIVATE_KEY=...
# OR for OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## Database Migrations

```prisma
// Add to schema.prisma

model ProjectInvitation {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  email     String
  role      UserRole
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([email])
  @@index([token])
}

// For AI Bot - requires pgvector extension
// Add to Article model:
// embedding Unsupported("vector(1536)")?
```

---

## Verification Checklist

### Announcements

- [ ] Create announcement in dashboard
- [ ] Edit announcement content and targeting
- [ ] Toggle enable/disable
- [ ] Verify shows in SDK widget by type
- [ ] Dismiss and verify showOnce

### Team Permissions

- [ ] Invite user by email
- [ ] Accept invitation and join project
- [ ] Change member role (admin only)
- [ ] Remove member (admin only)
- [ ] Verify viewer can't delete interactions
- [ ] Verify agent can respond but not delete

### Analytics

- [ ] View interaction volume chart
- [ ] Change time period (7d/30d/90d)
- [ ] See response time metrics
- [ ] View top feedback items
- [ ] Check survey stats

### Tours

- [ ] Create tour in dashboard with steps
- [ ] Call `Relay.tours.start('tour-id')` in SDK
- [ ] See tooltip positioned at element
- [ ] Navigate next/prev
- [ ] Skip and verify dismissed state

### Integrations

- [ ] Connect Jira (OAuth)
- [ ] Create Jira issue from interaction
- [ ] Update Jira status → see Relay update
- [ ] Connect GitHub
- [ ] Create GitHub issue from interaction
- [ ] Configure Discord webhook
- [ ] Verify notifications in Discord

### AI Bot

- [ ] Enable bot for project
- [ ] Ask question in SDK chat
- [ ] See answer from knowledge base
- [ ] Low confidence → escalate to human
