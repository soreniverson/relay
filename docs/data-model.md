# Relay Data Model

## Overview

Relay uses a unified data model centered around the `Interaction` entity. All user-submitted data (bugs, feedback, chat, surveys) flows through interactions.

## Core Entities

### Project

The top-level container. Each project:
- Belongs to a single region (data residency)
- Has its own API keys
- Contains all related data

```sql
projects(
  id UUID PRIMARY KEY,
  name VARCHAR(200),
  region ENUM('us-west', 'eu-west'),
  settings JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### API Key

Authentication for SDKs.

```sql
api_keys(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  key_hash VARCHAR(255),      -- bcrypt hash
  key_prefix VARCHAR(12),     -- for identification
  name VARCHAR(200),
  scopes TEXT[],              -- ['ingest', 'read', 'write', 'admin']
  created_at TIMESTAMP,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP
)
```

### End User

Users of your application (not dashboard users).

```sql
end_users(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  external_user_id VARCHAR(255),  -- your user ID
  email VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  traits JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP

  UNIQUE(project_id, external_user_id)
)
```

### Session

Browser/app session tracking.

```sql
sessions(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  user_id UUID REFERENCES end_users,
  started_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  device JSONB,              -- {type, os, browser, screen, etc.}
  app_version VARCHAR(100),
  environment ENUM('production', 'staging', 'development'),
  ip_hash VARCHAR(64),
  user_agent TEXT,
  page_views INTEGER,
  interaction_count INTEGER
)
```

### Interaction

The core entity. All user submissions are interactions.

```sql
interactions(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  type ENUM('bug', 'feedback', 'chat', 'survey', 'replay', 'system'),
  source ENUM('widget', 'sdk', 'api'),
  user_id UUID REFERENCES end_users,
  session_id UUID REFERENCES sessions,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  -- Content
  content_text TEXT,
  content_json JSONB,         -- {title, description, steps, annotations, etc.}

  -- Status
  status ENUM('new', 'triaging', 'in_progress', 'resolved', 'closed'),
  severity ENUM('low', 'med', 'high', 'critical'),
  tags TEXT[],
  assignee_id UUID,

  -- Linked Issue
  linked_issue_provider ENUM('linear', 'jira', 'github'),
  linked_issue_id VARCHAR(255),
  linked_issue_url TEXT,

  -- AI
  ai_summary TEXT,
  ai_labels TEXT[],
  ai_duplicate_group_id VARCHAR(64),
  ai_confidence FLOAT,

  -- Context
  privacy_scope JSONB,
  technical_context JSONB
)
```

### Media

Screenshots, videos, attachments.

```sql
media(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  interaction_id UUID REFERENCES interactions,
  kind ENUM('screenshot', 'video', 'attachment', 'replay_blob'),
  url TEXT,
  storage_key TEXT,
  content_type VARCHAR(100),
  size_bytes INTEGER,
  created_at TIMESTAMP,
  meta JSONB
)
```

### Interaction Logs

Console, network, and error logs.

```sql
interaction_logs(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  interaction_id UUID REFERENCES interactions,
  console JSONB,              -- [{level, message, timestamp, stack}]
  network JSONB,              -- [{method, url, status, duration}]
  errors JSONB,               -- [{message, stack, filename, line}]
  created_at TIMESTAMP
)
```

### Replay

Session replay recordings.

```sql
replays(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  session_id UUID REFERENCES sessions,
  interaction_id UUID REFERENCES interactions,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration INTEGER,           -- milliseconds
  event_count INTEGER,
  status ENUM('recording', 'processing', 'ready', 'failed'),
  chunks JSONB                -- [{index, storageKey, eventCount, startTime, endTime}]
)
```

## Feedback System

### Feedback Item

Consolidated feedback for voting.

```sql
feedback_items(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  title VARCHAR(500),
  description TEXT,
  status ENUM('under_review', 'planned', 'in_progress', 'shipped', 'wont_do'),
  category VARCHAR(100),
  vote_count INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by UUID,
  linked_interaction_count INTEGER
)
```

### Feedback Vote

User votes on feedback items.

```sql
feedback_votes(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  feedback_item_id UUID REFERENCES feedback_items,
  user_id UUID REFERENCES end_users,
  session_id UUID REFERENCES sessions,
  created_at TIMESTAMP

  UNIQUE(feedback_item_id, session_id)
)
```

### Feedback Link

Links interactions to feedback items.

```sql
feedback_links(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  feedback_item_id UUID REFERENCES feedback_items,
  interaction_id UUID REFERENCES interactions,
  created_at TIMESTAMP
)
```

## Roadmap

### Roadmap Item

Public/private roadmap entries.

```sql
roadmap_items(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  title VARCHAR(500),
  description TEXT,
  visibility ENUM('public', 'private'),
  status ENUM('planned', 'in_progress', 'shipped'),
  sort_order INTEGER,
  eta TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  linked_feedback_count INTEGER
)
```

## Surveys

### Survey

Survey definitions and targeting.

```sql
surveys(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  name VARCHAR(200),
  definition JSONB,           -- {type, title, questions, thankYouMessage}
  targeting JSONB,            -- {showOnce, showAfterSeconds, showOnPages, etc.}
  active BOOLEAN,
  response_count INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Survey Response

```sql
survey_responses(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  survey_id UUID REFERENCES surveys,
  interaction_id UUID REFERENCES interactions,
  responses JSONB,
  created_at TIMESTAMP
)
```

## Chat / Conversations

### Conversation

```sql
conversations(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  user_id UUID REFERENCES end_users,
  session_id UUID REFERENCES sessions,
  status ENUM('open', 'closed'),
  subject VARCHAR(500),
  assignee_id UUID,
  last_message_at TIMESTAMP,
  message_count INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Message

```sql
messages(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  conversation_id UUID REFERENCES conversations,
  direction ENUM('inbound', 'outbound'),
  body TEXT,
  author_id UUID,             -- admin user for outbound
  created_at TIMESTAMP,
  read_at TIMESTAMP,
  meta JSONB
)
```

## Admin & Audit

### Admin User

Dashboard users (not end users).

```sql
admin_users(
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP,
  last_login_at TIMESTAMP
)
```

### Project Membership

```sql
project_memberships(
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES admin_users,
  project_id UUID,
  role ENUM('owner', 'admin', 'agent', 'viewer'),
  joined_at TIMESTAMP

  UNIQUE(user_id, project_id)
)
```

### Audit Log

```sql
audit_logs(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  actor_type ENUM('user', 'admin', 'system', 'api'),
  actor_id VARCHAR(255),
  action VARCHAR(255),
  target_type VARCHAR(100),
  target_id VARCHAR(255),
  created_at TIMESTAMP,
  meta JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT
)
```

## Integrations

### Integration

```sql
integrations(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  provider ENUM('linear', 'jira', 'github', 'slack', 'email'),
  enabled BOOLEAN,
  config JSONB,               -- encrypted tokens, settings
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_sync_at TIMESTAMP

  UNIQUE(project_id, provider)
)
```

### Integration Link

Links external issues to internal entities.

```sql
integration_links(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  provider ENUM('linear', 'jira', 'github', 'slack', 'email'),
  external_id VARCHAR(255),
  internal_type VARCHAR(100),
  internal_id UUID,
  external_url TEXT,
  created_at TIMESTAMP
)
```

## Privacy

### Privacy Rule

```sql
privacy_rules(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  name VARCHAR(200),
  enabled BOOLEAN,
  rule JSONB,                 -- {type, selector, pattern, scope}
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Feature Flags

```sql
feature_flags(
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  flag VARCHAR(100),
  enabled BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP

  UNIQUE(project_id, flag)
)
```

## Indexes

Key indexes for performance:

```sql
-- Interactions
CREATE INDEX idx_interactions_project_type ON interactions(project_id, type);
CREATE INDEX idx_interactions_project_status ON interactions(project_id, status);
CREATE INDEX idx_interactions_project_created ON interactions(project_id, created_at);
CREATE INDEX idx_interactions_session ON interactions(session_id);
CREATE INDEX idx_interactions_duplicate ON interactions(ai_duplicate_group_id);

-- Sessions
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Media
CREATE INDEX idx_media_interaction ON media(interaction_id);

-- Feedback
CREATE INDEX idx_feedback_items_project_status ON feedback_items(project_id, status);
CREATE INDEX idx_feedback_votes_item ON feedback_votes(feedback_item_id);

-- Audit
CREATE INDEX idx_audit_project_created ON audit_logs(project_id, created_at);
```
