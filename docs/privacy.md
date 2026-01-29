# Relay Privacy & Compliance

## Overview

Relay is designed with privacy-first principles. This document covers data handling, privacy controls, and compliance features.

## Data Residency

### Multi-Region Architecture

Relay supports data residency requirements through isolated regional deployments:

| Region  | Location            | Identifier |
| ------- | ------------------- | ---------- |
| US-West | Oregon (us-west-2)  | `us-west`  |
| EU-West | Ireland (eu-west-1) | `eu-west`  |

### Data Isolation

Each region maintains complete data isolation:

- **Database**: Separate PostgreSQL instances
- **Cache**: Separate Redis clusters
- **Storage**: Separate S3 buckets
- **Queue**: Separate job queues
- **Processing**: In-region workers only

### Region Selection

Projects select their region at creation time. This cannot be changed later:

```typescript
await Relay.createProject({
  name: "My App",
  region: "eu-west", // Data stays in EU
});
```

## Privacy Controls

### Default Masking

Relay automatically masks sensitive data:

1. **Password Fields**: All password inputs are masked
2. **Credit Cards**: Patterns matching CC numbers are replaced
3. **Email Addresses**: Emails in replays are partially masked
4. **Phone Numbers**: Phone patterns are masked

### Custom Masking

#### CSS Selectors

```javascript
Relay.init({
  privacy: {
    maskSelectors: [".sensitive-data", "[data-private]", ".credit-card"],
    blockSelectors: [".secret-content", ".do-not-capture"],
  },
});
```

#### HTML Attributes

```html
<!-- Mask element content -->
<div class="relay-mask">This will be masked</div>

<!-- Block element completely -->
<div class="relay-block">This won't be captured at all</div>

<!-- Using data attributes -->
<input data-relay-mask type="text" />
```

### Privacy Rules (Dashboard)

Create privacy rules in the dashboard:

```typescript
// Rule structure
{
  name: "Mask Social Security Numbers",
  type: "pattern",
  pattern: "\\d{3}-\\d{2}-\\d{4}",
  action: "mask",
  scope: ["replay", "console", "network"]
}
```

### Input Masking

```javascript
Relay.init({
  privacy: {
    maskAllInputs: true, // Mask all input values
    maskAllText: false, // Don't mask general text
  },
});
```

### Network Request Privacy

```javascript
Relay.init({
  privacy: {
    // Don't capture request/response bodies
    networkBodyCapture: false,

    // Mask specific headers
    maskHeaders: ["Authorization", "X-API-Key"],

    // Exclude URLs from capture
    excludeUrls: [/\/api\/auth/, /payments\.stripe\.com/],
  },
});
```

## Data Retention

### Default Retention Periods

| Data Type       | Default  | Configurable Range |
| --------------- | -------- | ------------------ |
| Bug Reports     | 365 days | 30-730 days        |
| Feedback        | 365 days | 30-730 days        |
| Session Replays | 30 days  | 7-90 days          |
| Chat Messages   | 365 days | 30-730 days        |
| Audit Logs      | 2 years  | 1-7 years          |

### Configuring Retention

```typescript
// In dashboard settings
{
  retention: {
    interactions: 365,  // days
    replays: 30,
    sessions: 90,
    auditLogs: 730,
  }
}
```

### Automatic Cleanup

Data is automatically deleted after the retention period. The cleanup job runs daily at 3 AM UTC.

## User Data Requests

### Data Export

Export all data for a specific user:

```bash
# API endpoint
POST /api/privacy/export
{
  "userId": "user_123",
  "format": "json" | "csv"
}

# Response includes download URL
{
  "exportId": "exp_123",
  "downloadUrl": "https://...",
  "expiresAt": "2024-01-25T..."
}
```

### Data Deletion

Delete all data for a specific user:

```bash
POST /api/privacy/delete
{
  "userId": "user_123",
  "confirm": true
}
```

This deletes:

- All sessions
- All interactions
- All replay data
- All chat messages
- User profile data

## Audit Logging

### What's Logged

All significant actions are logged:

- User authentication (login, logout)
- Data access (view, export)
- Data modification (create, update, delete)
- Settings changes
- Integration actions

### Audit Log Structure

```typescript
{
  id: string,
  timestamp: Date,
  actorType: "user" | "admin" | "system" | "api",
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: {
    // Action-specific details
    changes?: { before: any, after: any },
    ipAddress?: string,
    userAgent?: string,
  }
}
```

### Accessing Audit Logs

```bash
GET /api/trpc/privacy.auditLogs
{
  "projectId": "proj_123",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "actorId?": "user_123",
  "action?": "interaction.update"
}
```

## Compliance Features

### GDPR Compliance

- **Right to Access**: Data export functionality
- **Right to Deletion**: User data deletion
- **Data Portability**: JSON/CSV export formats
- **Consent Management**: SDK consent APIs
- **Data Minimization**: Configurable capture settings
- **Purpose Limitation**: Data only used for debugging/feedback

### SDK Consent

```javascript
// Initialize without automatic capture
Relay.init({
  apiKey: "rly_...",
  autoCapture: false,
});

// Start capture after consent
if (userConsented) {
  Relay.startCapture();
}

// Stop capture
Relay.stopCapture();
```

### Cookie Notice Integration

```javascript
// Listen for consent changes
window.addEventListener("consentUpdated", (e) => {
  if (e.detail.analytics) {
    Relay.startCapture();
  } else {
    Relay.stopCapture();
  }
});
```

### CCPA Compliance

- **Do Not Sell**: User data is never sold
- **Opt-Out**: Easy opt-out via SDK
- **Disclosure**: Clear privacy policy

## Security

### Data Encryption

- **In Transit**: TLS 1.3 for all connections
- **At Rest**: AES-256 encryption for stored data
- **Secrets**: Encrypted using AWS KMS / HashiCorp Vault

### Access Control

```typescript
// Role-based access
{
  owner: ['*'],                    // Full access
  admin: ['read', 'write'],        // No billing
  agent: ['read', 'write:inbox'],  // Limited write
  viewer: ['read'],                // Read only
}
```

### API Key Security

- Keys are hashed before storage (bcrypt)
- Only key prefix is stored for identification
- Keys can be scoped to specific operations
- Keys can have expiration dates

## Best Practices

1. **Minimize Data Collection**: Only capture what you need
2. **Use Privacy Rules**: Configure masking for sensitive elements
3. **Regular Audits**: Review audit logs periodically
4. **Short Retention**: Use shortest retention that meets needs
5. **User Communication**: Inform users about data collection
6. **Team Access**: Use least-privilege access for team members
