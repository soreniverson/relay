# Phase 3 Implementation Plan: AI Layer + Advanced Targeting

## Summary

Phase 3 adds AI-powered features (summarization, auto-tagging, knowledge base, copilot) and completes the advanced targeting system (surveys, events, SDK enhancements).

**Prerequisites:**

- OpenAI API key for AI features
- API deployment for webhook endpoints (optional but recommended)

---

## Pre-Implementation: Infrastructure Setup

### OpenAI Integration

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview  # or gpt-3.5-turbo for cost savings
```

### Database Additions (Prisma)

```prisma
model Article {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])

  title       String
  slug        String
  content     String   @db.Text
  excerpt     String?
  categoryId  String?
  category    ArticleCategory? @relation(fields: [categoryId], references: [id])

  status      ArticleStatus @default(draft)
  publishedAt DateTime?

  viewCount   Int      @default(0)
  helpfulCount Int     @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, slug])
  @@index([projectId, status])
}

model ArticleCategory {
  id        String    @id @default(cuid())
  projectId String
  project   Project   @relation(fields: [projectId], references: [id])

  name      String
  slug      String
  order     Int       @default(0)

  articles  Article[]

  @@unique([projectId, slug])
}

enum ArticleStatus {
  draft
  published
  archived
}

model UserEvent {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])

  sessionId  String
  userId     String?

  name       String
  properties Json?
  timestamp  DateTime @default(now())

  @@index([projectId, name])
  @@index([sessionId])
  @@index([userId])
}
```

---

## 1. AI Processing (Priority 1)

### 1.1 OpenAI Client Library

**File:** `services/api/src/lib/openai.ts`

```typescript
// OpenAI client wrapper with:
// - Rate limiting
// - Error handling with retries
// - Token counting
// - Cost tracking (optional)

interface SummarizeResult {
  summary: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative";
  category: string | null;
}

// Functions:
// - summarizeInteraction(content, technicalContext) -> SummarizeResult
// - suggestReply(conversationHistory, knowledgeContext) -> string[]
// - findSimilarIssues(content, existingIssues) -> similarity scores
// - classifyContent(content) -> category, tags
```

### 1.2 Interaction Summarization

**Files to Update:**

- `services/api/src/routers/interactions.ts` - Add summarize mutation
- `services/api/src/workers/ai-processor.ts` - Background summarization job

**Implementation:**

```
1. Manual Summarization:
   - Add "Summarize with AI" button in inbox detail
   - Call OpenAI with interaction content + technical context
   - Store result in interaction.aiSummary
   - Display summary in inbox UI (already exists)

2. Auto-Summarization (background):
   - On new interaction, queue AI processing job
   - Worker processes queue, calls OpenAI
   - Updates interaction with summary, tags, sentiment
   - Respects rate limits (configurable per project)

3. Prompt Template:
   """
   Summarize this bug report/feedback in 1-2 sentences.
   Extract relevant tags (max 5).
   Determine sentiment (positive/neutral/negative).

   Title: {title}
   Description: {description}
   Technical Context:
   - URL: {url}
   - Browser: {browser}
   - Error: {error}
   """
```

### 1.3 Auto-Tagging and Categorization

**Implementation:**

```
1. Tag Extraction:
   - Use OpenAI to suggest tags from content
   - Match against existing project tags
   - Suggest new tags if confidence > threshold

2. Category Classification:
   - Define categories: bug, feature-request, question, praise, complaint
   - Train on labeled examples (few-shot in prompt)
   - Store in interaction.aiLabels (already exists)

3. UI Updates:
   - Show AI-suggested tags with "Accept" button
   - Allow editing before applying
   - Track acceptance rate for prompt improvement
```

### 1.4 Duplicate Detection

**Implementation:**

```
1. Embedding-based Similarity:
   - Generate embeddings for new interactions
   - Compare against recent interactions (last 30 days)
   - Flag potential duplicates above similarity threshold

2. Storage:
   - Store embeddings in separate table or use pgvector
   - For MVP: simple text similarity without embeddings

3. UI:
   - Show "Potential duplicates" section in inbox detail
   - Link to similar interactions
   - Allow marking as duplicate (links interactions)
```

### 1.5 Sentiment Analysis

**Implementation:**

```
1. Sentiment Detection:
   - Include in summarization prompt
   - Return: positive, neutral, negative, frustrated
   - Store in interaction metadata

2. UI Updates:
   - Show sentiment indicator in inbox list
   - Filter by sentiment
   - Alert on frustrated/negative (high priority)
```

---

## 2. Knowledge Base (Priority 2)

### 2.1 Article CRUD

**Files to Create:**

- `services/api/src/routers/articles.ts` - Article management
- `apps/web/src/app/dashboard/knowledge/page.tsx` - Article list
- `apps/web/src/app/dashboard/knowledge/[id]/page.tsx` - Article editor

**Implementation:**

```
1. Article Router:
   - list(projectId, status?, categoryId?) - List articles
   - get(articleId) - Get single article
   - create(title, content, categoryId?) - Create draft
   - update(articleId, data) - Update article
   - publish(articleId) - Set status to published
   - archive(articleId) - Set status to archived
   - delete(articleId) - Hard delete

2. Article Editor:
   - Markdown editor with preview
   - Title and slug (auto-generated, editable)
   - Category selector
   - Publish/unpublish toggle
   - Preview button

3. Article List:
   - Filter by status (draft/published/archived)
   - Filter by category
   - Search by title
   - Bulk actions (publish, archive, delete)
```

### 2.2 Category Management

**Implementation:**

```
1. Category Router:
   - list(projectId) - List categories
   - create(name) - Create category
   - update(categoryId, name, order) - Update
   - delete(categoryId) - Delete (moves articles to uncategorized)
   - reorder(categoryIds[]) - Batch reorder

2. UI:
   - Sidebar in knowledge base with categories
   - Drag-and-drop reordering
   - Category CRUD modal
```

### 2.3 Public Help Center

**File:** `apps/web/src/app/help/[slug]/page.tsx`

**Implementation:**

```
1. Public Page:
   - Project branding (name, logo)
   - Category sidebar
   - Article list with search
   - Article detail view
   - "Was this helpful?" feedback

2. SEO:
   - Dynamic meta tags
   - Sitemap generation
   - Schema.org markup

3. API Endpoints:
   - articles.publicList(slug, categoryId?, search?)
   - articles.publicGet(slug, articleSlug)
   - articles.markHelpful(articleId, helpful: boolean)
```

### 2.4 Search

**Implementation:**

```
Phase 1: Full-text Search
   - PostgreSQL full-text search on title + content
   - Rank by relevance
   - Highlight matching snippets

Phase 2: Semantic Search (later)
   - Generate embeddings for articles
   - Store in pgvector
   - Semantic similarity search
```

### 2.5 SDK Widget Integration

**File:** `packages/sdk-web/src/ui/HelpCenter.tsx`

**Implementation:**

```
1. Help Center View in Widget:
   - New tab/view in SDK widget
   - Search box
   - Category browsing
   - Article preview with "View full article" link

2. Contextual Help:
   - Match current page URL to article tags
   - Show relevant articles automatically
   - "Suggested help" section

3. SDK Methods:
   - Relay.showHelp() - Open help center
   - Relay.showArticle(slug) - Open specific article
   - Relay.searchHelp(query) - Search articles
```

---

## 3. AI Copilot (Priority 3)

### 3.1 Suggested Replies

**Files to Update:**

- `services/api/src/routers/conversations.ts` - Add suggest mutation
- `apps/web/src/app/dashboard/conversations/page.tsx` - Show suggestions

**Implementation:**

```
1. Reply Suggestion:
   - Analyze conversation history
   - Include relevant KB articles as context
   - Generate 2-3 reply options
   - User selects, edits, or dismisses

2. Prompt Template:
   """
   You are a support agent for {projectName}.

   Conversation history:
   {messages}

   Relevant knowledge base articles:
   {articles}

   Generate 2-3 helpful reply options. Be concise and professional.
   """

3. UI:
   - "Suggest replies" button in conversation view
   - Show suggestions in collapsible section
   - Click to insert into reply box
   - Track which suggestions are used
```

### 3.2 Article Suggestions

**Implementation:**

```
1. Contextual Suggestions:
   - When viewing interaction/conversation
   - Search KB for relevant articles
   - Show "Suggested articles" section
   - One-click to insert link in reply

2. Matching Logic:
   - Extract keywords from conversation
   - Search articles by keyword
   - Rank by relevance
   - Cache results for conversation
```

### 3.3 Quick Insert

**Implementation:**

```
1. Article Link Insertion:
   - Button in reply composer: "Insert article"
   - Modal with article search
   - Insert formatted link

2. Canned Responses (bonus):
   - Pre-defined response templates
   - Variable substitution ({user.name}, etc.)
   - Quick access via slash commands
```

---

## 4. SDK Enhancements (Priority 4)

### 4.1 Programmatic Control

**File:** `packages/sdk-web/src/index.ts`

**Implementation:**

```typescript
// New SDK methods:

// Open widget to specific view
Relay.open(view?: 'bug' | 'feedback' | 'chat' | 'help' | 'survey')

// Close widget
Relay.close()

// Toggle widget
Relay.toggle()

// Prefill form data
Relay.prefill({
  title?: string,
  description?: string,
  email?: string,
  category?: string,
  metadata?: Record<string, any>
})

// Clear prefilled data
Relay.clearPrefill()

// Set custom data (sent with all interactions)
Relay.setCustomData(key: string, value: any)

// Check if widget is open
Relay.isOpen(): boolean
```

### 4.2 Event Tracking

**Implementation:**

```typescript
// Track custom events
Relay.track(eventName: string, properties?: Record<string, any>)

// Examples:
Relay.track('purchase_completed', { value: 99.99, currency: 'USD' })
Relay.track('feature_used', { feature: 'export' })
Relay.track('page_viewed', { page: '/pricing' })

// Internal:
// - Batch events (send every 5s or 10 events)
// - POST to /trpc/ingest.trackEvents
// - Store in UserEvent table
// - Use for survey targeting
```

---

## 5. Survey System Complete (Priority 5)

### 5.1 User Trait Targeting

**Implementation:**

```
1. Targeting Schema Update:
   Survey.targeting.userTraits: {
     plan: 'pro',
     signupDate: { $gt: '2024-01-01' },
     country: { $in: ['US', 'CA', 'UK'] }
   }

2. Matching Logic:
   - Fetch user traits from identify() call
   - Match against targeting rules
   - Support operators: $eq, $ne, $gt, $lt, $in, $contains

3. API Update:
   - surveys.getActiveSurveys includes trait matching
   - Pass current user traits from SDK
```

### 5.2 Event-Based Triggers

**Implementation:**

```
1. Targeting Schema:
   Survey.targeting.triggerEvent: 'purchase_completed'
   Survey.targeting.triggerEventCount: 1  // optional, default 1

2. SDK Integration:
   - After Relay.track(), check for matching surveys
   - Call surveys.getActiveSurveys with event context
   - Show matching survey if conditions met

3. Examples:
   - Show NPS after 3rd purchase
   - Show feedback survey after using feature
   - Show exit survey when user visits /cancel
```

### 5.3 SDK Survey Rendering

**File:** `packages/sdk-web/src/ui/Survey.tsx`

**Implementation:**

```
1. Survey Fetching:
   - On init, check for active surveys
   - Filter by URL, traits, events
   - Respect showOnce (localStorage)
   - Apply sample rate

2. Survey UI Component:
   - Modal overlay
   - Question types:
     - NPS (0-10 scale)
     - Rating (1-5 stars)
     - Single choice
     - Multi choice
     - Text (short/long)
   - Progress indicator for multi-question
   - Skip and submit buttons

3. Response Submission:
   - POST to surveys.respond
   - Mark as completed in localStorage
   - Thank you message
   - Optional follow-up CTA

4. Triggers:
   - Auto-show after delay (showAfterSeconds)
   - Manual: Relay.showSurvey(surveyId?)
   - Event-based (after track())
```

---

## File Summary

| Action | File                                                            |
| ------ | --------------------------------------------------------------- |
| Create | `services/api/src/lib/openai.ts` - OpenAI client                |
| Create | `services/api/src/routers/articles.ts` - Knowledge base         |
| Create | `services/api/src/workers/ai-processor.ts` - Background AI jobs |
| Update | `services/api/src/routers/interactions.ts` - Add summarize      |
| Update | `services/api/src/routers/conversations.ts` - Add suggest       |
| Update | `services/api/src/routers/surveys.ts` - Trait/event targeting   |
| Update | `services/api/src/routers/ingest.ts` - Event tracking           |
| Update | `services/api/prisma/schema.prisma` - Article, UserEvent models |
| Create | `apps/web/src/app/dashboard/knowledge/page.tsx` - Article list  |
| Create | `apps/web/src/app/dashboard/knowledge/[id]/page.tsx` - Editor   |
| Create | `apps/web/src/app/help/[slug]/page.tsx` - Public help center    |
| Update | `packages/sdk-web/src/index.ts` - Programmatic control, events  |
| Create | `packages/sdk-web/src/ui/Survey.tsx` - Survey renderer          |
| Create | `packages/sdk-web/src/ui/HelpCenter.tsx` - Help center widget   |

---

## Environment Variables (New)

```
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Optional: Cost controls
OPENAI_MAX_TOKENS_PER_REQUEST=2000
OPENAI_DAILY_LIMIT_USD=10
```

---

## Implementation Order

### Week 1: AI Foundation

1. Set up OpenAI client library
2. Implement interaction summarization (manual + auto)
3. Add auto-tagging
4. Update inbox UI to show AI features

### Week 2: Knowledge Base Core

1. Add Prisma models (Article, ArticleCategory)
2. Implement article CRUD router
3. Build article editor page
4. Build article list page

### Week 3: Knowledge Base Public

1. Build public help center page
2. Implement search (full-text)
3. Add "Was this helpful?" feedback
4. SDK help center integration

### Week 4: AI Copilot + Surveys

1. Implement suggested replies
2. Add article suggestions in conversations
3. Complete survey rendering in SDK
4. Add event tracking and trait targeting

---

## Verification Checklist

### AI Processing

- [ ] Click "Summarize" on interaction → summary appears
- [ ] New interactions auto-summarized (if enabled)
- [ ] Tags suggested and applicable
- [ ] Sentiment indicator visible

### Knowledge Base

- [ ] Create, edit, publish article
- [ ] Public help center accessible at /help/[slug]
- [ ] Search returns relevant results
- [ ] "Was this helpful?" records feedback

### AI Copilot

- [ ] "Suggest replies" generates options
- [ ] Clicking suggestion inserts into reply box
- [ ] Relevant articles shown in conversation view

### SDK Enhancements

- [ ] `Relay.open('feedback')` opens feedback form
- [ ] `Relay.prefill({ title: 'Test' })` prefills form
- [ ] `Relay.track('event')` sends to API

### Survey System

- [ ] Survey with user trait targeting shows to matching users
- [ ] Survey with event trigger shows after track() call
- [ ] Survey renders in SDK with all question types
- [ ] Response submitted and recorded
