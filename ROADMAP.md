# Relay 2026 Roadmap

## Vision

**Gleap's depth + Intercom's simplicity** — a product intelligence platform that indie devs and startups actually want to use.

---

## Current State (January 2026)

### Working

- [x] SDK: Bug reports, feedback, chat, screenshots, annotations, replay capture, user identification, programmatic control, event tracking, survey rendering
- [x] API: Sessions, interactions, conversations, surveys, feedback, roadmap, announcements, integrations, knowledge base, AI processing
- [x] Dashboard: Inbox (with AI summarization), conversations (with AI copilot), surveys, feedback, roadmap, knowledge base, settings (fully wired)
- [x] Public Pages: Roadmap, feedback board, changelog, help center (all with voting/feedback)
- [x] Integrations: Linear OAuth + issue creation, Slack webhooks
- [x] Billing: Stripe Checkout, Customer Portal, usage tracking
- [x] Replays: rrweb-player with playback controls
- [x] AI Features: OpenAI integration, interaction summarization, suggested replies, relevant article suggestions
- [x] Knowledge Base: Article CRUD, categories, public help center, search
- [x] Infrastructure: Docker, Postgres, Redis, MinIO, multi-region schema
- [x] Auth: Password-based login/signup (replaced magic links for simplicity)
- [x] CI/CD: GitHub Actions (lint, typecheck, test, build) + Vercel deployment

### Needs Completion

- [x] AI features (Phase 3 complete: summarization, copilot, knowledge base)
- [ ] API deployment (currently using Vercel frontend only)
- [ ] Linear webhook registration (requires deployed API)
- [ ] Duplicate detection (deferred to Phase 4)

---

## Phase 0: Launch Blockers ✅ COMPLETE

_Completed January 29, 2026_

### 0.1 Authentication

- [x] Password-based auth (replaced magic links for simplicity)
- [x] Login and signup pages functional
- [x] JWT token-based sessions
- [ ] ~~Magic link emails~~ (punted - password auth is simpler for MVP)
- [ ] Basic transactional templates (deferred to Phase 1)

### 0.2 Deployment Pipeline

- [x] GitHub Actions: lint, typecheck, test, build
- [x] Railway deployment for API (api-production-6495.up.railway.app)
- [x] Vercel deployment for dashboard (relay-rouge.vercel.app)
- [x] Supabase PostgreSQL database
- [x] Database migrations via Prisma

### 0.3 Core Dashboard Wiring

- [x] Inbox → tRPC API integration complete
- [x] Conversations → real messaging with tRPC
- [x] Settings → API keys (create, list, revoke) functional
- [x] Feedback page → real API calls
- [x] SDK widget tested and working locally

---

## Phase 1: Paid Beta ✅ COMPLETE

_Completed January 2026_

### 1.1 Billing & Subscriptions

- [x] Stripe integration (Checkout, Customer Portal, Webhooks)
- [x] Plan tiers: Free, Pro ($29/mo) — Team tier deferred to Phase 2
- [x] Usage limits enforcement (sessions, interactions)
- [x] Billing settings page functional

### 1.2 Replay System Complete

- [x] Replay chunk processing in worker
- [x] MinIO storage with proper retention
- [x] rrweb-player integration in dashboard
- [x] Replay scrubbing, speed controls, event markers

### 1.3 Onboarding Flow

- [x] Project creation wizard
- [x] SDK installation guide with copy-paste snippets
- [x] First interaction celebration/confirmation
- [x] Quick start checklist in dashboard

---

## Phase 2: Gleap Parity ✅ COMPLETE

_Completed January 2026_

### 2.1 Integrations - Core

- [x] **Linear**: OAuth connection, create issues from inbox, bidirectional sync (webhook pending API deployment)
- [x] **Slack**: Webhook URL storage, notification sending infrastructure
- [x] **Webhooks**: Webhook model, delivery framework scaffolded

### 2.2 Public Pages

- [x] Public roadmap page (`/roadmap/[slug]`) with voting
- [x] Public feedback board (`/feedback/[slug]`) with voting and idea submission
- [x] Public changelog/announcements page (`/changelog/[slug]`)
- [x] Project slug configuration in settings

### 2.3 SDK Enhancements

- [x] Custom trigger positioning and styling
- [x] User identification with traits (`Relay.identify()`)

### 2.4 Survey Targeting

- [x] URL-based targeting (API-side)
- [x] Sampling and frequency caps (showOnce, sampleRate)

---

## Phase 3: AI Layer + Advanced Targeting ✅ COMPLETE

_Completed January 2026_

_Differentiation through intelligence._

### 3.1 AI Processing (OpenAI Integration)

- [x] OpenAI client library (`services/api/src/lib/openai.ts`)
- [x] Interaction summarization (one-click summarize in inbox)
- [x] Auto-tagging and categorization (AI-generated tags)
- [x] Sentiment analysis (integrated with summarization)
- [ ] Duplicate detection and linking (deferred to Phase 4)

### 3.2 Knowledge Base - MVP

- [x] Article CRUD with markdown editor
- [x] Category organization
- [x] Public help center page (`/help/[slug]`)
- [x] Full-text search (Postgres ILIKE)
- [x] Article feedback (helpful/not helpful)
- [ ] SDK widget integration (deferred - help center is public page)

### 3.3 AI Copilot - Basic

- [x] Suggested replies in conversation view
- [x] Relevant article suggestions
- [x] One-click copy suggested reply
- [x] Copilot toggle in conversation UI

### 3.4 SDK Enhancements

- [x] Programmatic control (`open()`, `close()`, `toggle()`, `isOpen()`)
- [x] Form prefilling (`prefill()`, `clearPrefill()`)
- [x] Custom data (`setCustomData()`, `getCustomData()`, `clearCustomData()`)
- [x] Event tracking (`track()` with batching)
- [x] Session/user info (`getSessionId()`, `getUserId()`, `isInitialized()`)

### 3.5 Survey System Complete

- [x] User trait targeting with operators ($gt, $lt, $gte, $lte, $contains, $in, $nin)
- [x] Event-based triggers (triggerEvent, triggerEventCount)
- [x] Frequency caps (maxShowsPerUser, minDaysBetweenShows)
- [x] SDK survey rendering (`showSurvey()`, `checkForSurveys()`)
- [x] Question types: NPS, rating, text, single/multi choice

---

## Phase 4: Growth Features (Week 11-14)

_Features that drive adoption and retention._

### 4.1 Integrations - Extended

- [ ] **Jira**: OAuth, issue creation, status sync
- [ ] **GitHub**: Issue creation, PR linking
- [ ] **Discord**: Webhook notifications
- [ ] **Zapier**: Triggers and actions

### 4.2 Team Features

- [ ] Role-based permissions (Owner, Admin, Agent, Viewer)
- [ ] Team inbox assignment and routing
- [ ] Internal notes on interactions
- [ ] @mentions and collaboration

### 4.3 Analytics Dashboard

- [ ] Interaction volume over time
- [ ] Response time metrics
- [ ] Survey response rates
- [ ] Top feedback items
- [ ] User satisfaction trends

### 4.4 AI Bot (Kai) - V1

- [ ] Knowledge base embeddings (pgvector)
- [ ] RAG pipeline for answers
- [ ] Confidence-based escalation to human
- [ ] Bot configuration in dashboard

### 4.5 Product Tours

- [ ] Tour builder with step editor
- [ ] Step types: tooltip, modal, highlight, beacon
- [ ] Element targeting with CSS selectors
- [ ] Progress tracking per user
- [ ] URL and user trait targeting
- [ ] SDK integration (`Relay.tours.start()`)

### 4.6 In-App Announcements

- [ ] Announcement types: banner, modal, slideout, feed item
- [ ] Rich content with markdown/images
- [ ] Scheduling (start/end dates)
- [ ] Targeting by URL, user traits, segments
- [ ] Dismissible with "show once" option
- [ ] View/click analytics

---

## Phase 5: Scale & Polish (Week 15-20)

_Production hardening and advanced features._

### 5.1 Performance & Reliability

- [ ] Redis caching layer for hot paths
- [ ] Database query optimization
- [ ] Rate limiting and abuse prevention
- [ ] Error monitoring (Sentry)
- [ ] Uptime monitoring

### 5.2 Compliance & Security

- [ ] GDPR data export/deletion
- [ ] PII masking in replays
- [ ] Audit logging
- [ ] SOC 2 preparation (documentation)

### 5.3 Advanced Automation

- [ ] Workflow builder (trigger → condition → action)
- [ ] Auto-assignment rules
- [ ] SLA tracking and alerts
- [ ] Scheduled reports

### 5.4 Mobile SDKs

- [ ] React Native SDK
- [ ] iOS Swift SDK (if demand)
- [ ] Android Kotlin SDK (if demand)

### 5.5 Email Campaigns

- [ ] Visual email builder (MJML or React Email)
- [ ] User segmentation (traits, events, tags)
- [ ] Campaign scheduling
- [ ] A/B testing (subject lines, content)
- [ ] Analytics (open rate, click rate, unsubscribes)
- [ ] Unsubscribe management and compliance
- [ ] Drip sequence support

---

## Pricing Strategy

### Free Tier

- 1 project
- 1,000 sessions/month
- 100 interactions/month
- 7-day replay retention
- Community support

### Pro - $29/month

- 3 projects
- 10,000 sessions/month
- Unlimited interactions
- 30-day replay retention
- 2 team members
- Email support
- Linear + Slack integrations

### Team - $79/month

- Unlimited projects
- 50,000 sessions/month
- Unlimited interactions
- 90-day replay retention
- 10 team members
- Priority support
- All integrations
- AI features
- Custom branding

### Enterprise - Custom

- Unlimited everything
- Data residency options
- SSO/SAML
- Dedicated support
- SLA guarantees

---

## Success Metrics

| Milestone             | Target                   | Date     |
| --------------------- | ------------------------ | -------- |
| Public beta launch    | Live, accepting signups  | Feb 2026 |
| First 100 users       | Free tier adoption       | Mar 2026 |
| First paying customer | Pro tier conversion      | Mar 2026 |
| 50 paying customers   | $1,500 MRR               | May 2026 |
| Gleap feature parity  | All core features        | Apr 2026 |
| AI features live      | Knowledge base + copilot | May 2026 |
| 200 paying customers  | $6,000 MRR               | Aug 2026 |
| Mobile SDKs           | React Native minimum     | Oct 2026 |

---

## Tech Debt & Maintenance

_Ongoing, not blocking launch._

- [ ] Increase test coverage (target: 70%)
- [ ] API documentation (OpenAPI/Swagger)
- [ ] SDK documentation site
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Dependency updates

---

## What We're NOT Building (Yet)

_Explicitly out of scope for 2026._

- ❌ Native mobile apps (dashboard)
- ❌ White-labeling
- ❌ Multi-language support
- ❌ Video feedback
- ❌ Co-browsing

These are 2027+ features after core product-market fit.

---

## Next Action

**Start Phase 4** — Growth Features with extended integrations, team features, analytics, and AI bot.

**Priority items:**

1. Jira + GitHub integrations (extend existing integration framework)
2. Team roles and permissions (Owner, Admin, Agent, Viewer)
3. Analytics dashboard (interaction volume, response times)
4. Product tours (SDK integration for guided onboarding)

**Infrastructure (when ready):**

- Deploy API for webhook endpoints
- Register Linear webhook for bidirectional sync
