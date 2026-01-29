# Relay Architecture

## Overview

Relay is a multi-region feedback, bug reporting, and customer support platform with the following core components:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Global Edge                                   │
│  ┌─────────────┐                                                        │
│  │   Router    │ ───> Route requests to correct region based on API key │
│  └─────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│      US-West Region      │    │      EU-West Region      │
│  ┌────────────────────┐  │    │  ┌────────────────────┐  │
│  │    API Service     │  │    │  │    API Service     │  │
│  │    (tRPC + WS)     │  │    │  │    (tRPC + WS)     │  │
│  └────────────────────┘  │    │  └────────────────────┘  │
│           │              │    │           │              │
│  ┌────────────────────┐  │    │  ┌────────────────────┐  │
│  │  Worker Service    │  │    │  │  Worker Service    │  │
│  │ (AI, Integrations) │  │    │  │ (AI, Integrations) │  │
│  └────────────────────┘  │    │  └────────────────────┘  │
│           │              │    │           │              │
│  ┌────────┴────────┐     │    │  ┌────────┴────────┐     │
│  │                 │     │    │  │                 │     │
│  ▼                 ▼     │    │  ▼                 ▼     │
│ PostgreSQL      Redis    │    │ PostgreSQL      Redis    │
│                          │    │                          │
│  ┌─────────────────┐     │    │  ┌─────────────────┐     │
│  │  MinIO (S3)     │     │    │  │  MinIO (S3)     │     │
│  │  Media Storage  │     │    │  │  Media Storage  │     │
│  └─────────────────┘     │    │  └─────────────────┘     │
└──────────────────────────┘    └──────────────────────────┘
```

## Core Principles

### 1. Data Residency

- Each region operates independently with its own database, cache, and storage
- No cross-region data replication for user data
- Only control plane metadata (project registry) may be shared globally
- AI processing must run in-region or use providers with regional endpoints

### 2. Cell Architecture

Each region is a "cell" with:

- API server (Express + tRPC)
- Worker service (async jobs)
- PostgreSQL database
- Redis (cache + queues + pub/sub)
- S3-compatible storage (MinIO locally, S3/R2 in production)

### 3. Service Boundaries

**API Service (services/api)**

- Handles all HTTP/WebSocket requests
- tRPC for type-safe API
- Session management
- Real-time via WebSocket

**Worker Service (services/worker)**

- AI summarization and classification
- Integration sync (Linear, Slack)
- Email delivery
- Replay processing
- Scheduled jobs

**Router Service (services/router)**

- Edge routing
- API key validation
- Rate limiting
- Request forwarding

## Data Flow

### SDK Ingestion Flow

```
SDK → Router → Region API → Database
                    │
                    ├──> Redis (session cache)
                    ├──> S3 (media upload)
                    └──> Queue (worker jobs)
```

### Replay Recording Flow

```
SDK (rrweb) → Chunk Upload → S3
                    │
                    └──> Metadata → PostgreSQL
```

### Integration Flow

```
Dashboard → API → Integration Service
                        │
                        ├──> Linear API
                        ├──> Slack Webhook
                        └──> GitHub API (TODO)
```

## Security

### Authentication

1. **SDK Authentication**: API keys (hashed, scoped)
2. **Dashboard Authentication**: Magic link + JWT
3. **Integration Authentication**: OAuth 2.0

### Authorization

- Role-based access control (RBAC)
- Project-level permissions
- Scoped API keys

### Privacy

- PII masking by default
- Configurable privacy rules
- Audit logging
- Data retention policies

## Scalability

### Horizontal Scaling

- API servers are stateless
- Workers use distributed queues
- Database read replicas for queries

### Performance

- Redis caching for hot paths
- CDN for media delivery
- Connection pooling
- Rate limiting per API key

## Deployment

### Local Development

```bash
docker-compose -f infra/local/docker-compose.yml up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

### Production

- Kubernetes or container orchestration
- Terraform for infrastructure
- GitHub Actions for CI/CD
- Multi-region deployment

## Technology Stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | Next.js 14, React, TypeScript, Tailwind, shadcn/ui |
| API      | Node.js, Express, tRPC, Prisma                     |
| Database | PostgreSQL 16                                      |
| Cache    | Redis 7                                            |
| Storage  | S3 / MinIO                                         |
| Queue    | Redis (Bull)                                       |
| Realtime | WebSocket (ws)                                     |
| Replay   | rrweb                                              |
| AI       | OpenAI (optional)                                  |
