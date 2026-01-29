# Relay API Reference

## Overview

Relay uses tRPC for type-safe API communication. The API is organized into routers:

- **ingest**: SDK data ingestion
- **interactions**: Bug reports, feedback management
- **feedback**: Feedback board operations
- **roadmap**: Product roadmap
- **surveys**: Survey management
- **conversations**: Live chat
- **integrations**: Third-party integrations
- **privacy**: Privacy rules and audit logs

## Authentication

### SDK Authentication

SDK endpoints use API key authentication via the `X-API-Key` header:

```bash
curl -X POST https://api.relay.dev/v1/ingest/session \
  -H "X-API-Key: rly_prod_your_key" \
  -H "Content-Type: application/json" \
  -d '{"device": {"type": "desktop"}}'
```

### Dashboard Authentication

Dashboard endpoints use JWT tokens via cookies or Bearer authentication:

```bash
curl https://api.relay.dev/api/trpc/interactions.list \
  -H "Authorization: Bearer <jwt_token>"
```

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| SDK Ingest | 1000 req/min per API key |
| Dashboard | 100 req/min per user |
| Media Upload | 50 req/min per API key |

## SDK Endpoints

### Initialize Session

```typescript
POST /v1/ingest/session

Request:
{
  "sessionId?": string,
  "user?": {
    "id": string,
    "email?": string,
    "name?": string,
    "traits?": Record<string, any>
  },
  "device?": {
    "type": "desktop" | "mobile" | "tablet",
    "os?": string,
    "browser?": string,
    "screenWidth?": number,
    "screenHeight?": number
  },
  "appVersion?": string,
  "environment?": "production" | "staging" | "development"
}

Response:
{
  "sessionId": string,
  "userId?": string,
  "projectSettings": {
    "captureConsole": boolean,
    "captureNetwork": boolean,
    "replayEnabled": boolean,
    "privacyRules": PrivacyRule[]
  }
}
```

### Create Interaction

```typescript
POST /v1/ingest/interaction

Request:
{
  "id?": string,          // Client-generated for idempotency
  "type": "bug" | "feedback" | "chat" | "survey",
  "source": "widget" | "sdk" | "api",
  "sessionId": string,
  "contentText?": string,
  "contentJson?": {
    "title?": string,
    "description?": string,
    "steps?": string[],
    "annotations?": Annotation[],
    // type-specific fields
  },
  "severity?": "low" | "med" | "high" | "critical",
  "tags?": string[]
}

Response:
{
  "id": string,
  "createdAt": string
}
```

### Upload Logs

```typescript
POST /v1/ingest/logs

Request:
{
  "interactionId": string,
  "console?": Array<{
    "level": "log" | "warn" | "error" | "info",
    "message": string,
    "timestamp": number,
    "stack?": string
  }>,
  "network?": Array<{
    "method": string,
    "url": string,
    "status": number,
    "duration": number,
    "requestSize?": number,
    "responseSize?": number
  }>,
  "errors?": Array<{
    "message": string,
    "stack?": string,
    "filename?": string,
    "line?": number,
    "column?": number
  }>
}
```

### Start Replay

```typescript
POST /v1/ingest/replay/start

Request:
{
  "sessionId": string,
  "interactionId?": string
}

Response:
{
  "replayId": string
}
```

### Upload Replay Chunk

```typescript
POST /v1/ingest/replay/chunk

Request:
{
  "replayId": string,
  "chunkIndex": number,
  "events": RRWebEvent[]
}
```

### Get Media Upload URL

```typescript
POST /v1/ingest/media/upload-url

Request:
{
  "interactionId": string,
  "kind": "screenshot" | "video" | "attachment",
  "contentType": string,
  "filename": string
}

Response:
{
  "uploadUrl": string,
  "mediaId": string,
  "expiresIn": number
}
```

## Dashboard Endpoints

### List Interactions

```typescript
GET /api/trpc/interactions.list

Query:
{
  "projectId": string,
  "type?": string[],
  "status?": string[],
  "severity?": string[],
  "assigneeId?": string,
  "search?": string,
  "cursor?": string,
  "limit?": number
}

Response:
{
  "items": Interaction[],
  "nextCursor?": string
}
```

### Get Interaction

```typescript
GET /api/trpc/interactions.get

Query:
{
  "id": string
}

Response: Interaction
```

### Update Interaction

```typescript
POST /api/trpc/interactions.update

Request:
{
  "id": string,
  "status?": string,
  "severity?": string,
  "assigneeId?": string,
  "tags?": string[]
}
```

### Feedback Board

```typescript
// List feedback items
GET /api/trpc/feedback.list
Query: { projectId, status?, category?, cursor?, limit? }

// Create feedback item
POST /api/trpc/feedback.create
Request: { title, description?, category? }

// Vote on feedback
POST /api/trpc/feedback.vote
Request: { feedbackItemId }
```

### Roadmap

```typescript
// List roadmap items
GET /api/trpc/roadmap.list
Query: { projectId, visibility?, status? }

// Create roadmap item
POST /api/trpc/roadmap.create
Request: { title, description, status, visibility, eta? }
```

### Surveys

```typescript
// List surveys
GET /api/trpc/surveys.list
Query: { projectId, active? }

// Create survey
POST /api/trpc/surveys.create
Request: {
  name: string,
  definition: SurveyDefinition,
  targeting: SurveyTargeting
}

// Get survey for end user (SDK)
GET /v1/survey/check
Query: { sessionId, event?, pageUrl? }
```

### Conversations

```typescript
// List conversations
GET /api/trpc/conversations.list
Query: { projectId, status?, cursor?, limit? }

// Send message
POST /api/trpc/conversations.sendMessage
Request: { conversationId, body }
```

### Integrations

```typescript
// List integrations
GET /api/trpc/integrations.list
Query: { projectId }

// Connect integration
POST /api/trpc/integrations.connect
Request: { provider, config }

// Create external issue
POST /api/trpc/integrations.createIssue
Request: { interactionId, provider, data }
```

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Too many requests |
| `VALIDATION_ERROR` | Invalid request data |
| `INTERNAL_ERROR` | Server error |

## Webhooks

Configure webhooks to receive events:

```typescript
POST /api/trpc/webhooks.create

Request:
{
  "url": string,
  "events": string[],  // ["interaction.created", "status.changed", ...]
  "secret": string     // For signature verification
}
```

Webhook payload:

```typescript
{
  "event": string,
  "timestamp": string,
  "data": {
    // Event-specific data
  }
}
```

Verify webhook signature:

```typescript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');

const isValid = signature === request.headers['x-relay-signature'];
```
