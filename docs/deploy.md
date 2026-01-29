# Relay Deployment Guide

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/relay.git
cd relay

# Copy environment files
cp .env.example .env

# Start infrastructure
docker-compose -f infra/local/docker-compose.yml up -d

# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start development servers
pnpm dev
```

This starts:

- Web dashboard: http://localhost:3000
- API server: http://localhost:3001
- MinIO console: http://localhost:9001
- Mailhog: http://localhost:8025

### Demo Credentials

After seeding:

- **Email**: admin@relay.dev
- **Password**: password123 (or use magic link)

## Production Deployment

### Infrastructure Requirements

Per region:

- PostgreSQL 16+ (managed recommended)
- Redis 7+ (managed recommended)
- S3-compatible storage
- Compute (Kubernetes, ECS, or VMs)

### Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
JWT_SECRET="your-secret-key"
REGION="us-west"

# S3/Storage
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_BUCKET="relay-us-west-media"
AWS_REGION="us-west-2"

# Optional: AI
OPENAI_API_KEY="..."

# Optional: Integrations
LINEAR_CLIENT_ID="..."
LINEAR_CLIENT_SECRET="..."
SLACK_CLIENT_ID="..."
SLACK_CLIENT_SECRET="..."
```

### Docker Build

```dockerfile
# API Service
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @relay/api build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/services/api/prisma ./prisma
COPY --from=builder /app/services/api/package.json .
RUN npm install --production
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: relay-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: relay-api
  template:
    metadata:
      labels:
        app: relay-api
    spec:
      containers:
        - name: api
          image: relay/api:latest
          ports:
            - containerPort: 3001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: relay-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: relay-secrets
                  key: redis-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 20
```

### Database Migrations

Run migrations before deploying new versions:

```bash
# From CI/CD or migration job
DATABASE_URL="..." npx prisma migrate deploy
```

### Multi-Region Setup

1. **Deploy infrastructure per region**
   - Separate databases, Redis, storage buckets
   - No cross-region replication

2. **Deploy services per region**
   - API and worker services
   - Configure region-specific environment

3. **Configure edge routing**
   - Route based on API key -> project -> region
   - Use Cloudflare Workers or AWS Lambda@Edge

4. **Configure CDN per region**
   - CloudFront, Cloudflare, or similar
   - Region-specific origins for media

### Scaling Considerations

| Component | Scaling Strategy         |
| --------- | ------------------------ |
| API       | Horizontal (stateless)   |
| Worker    | Horizontal (queue-based) |
| Database  | Vertical + read replicas |
| Redis     | Cluster mode             |
| Storage   | Managed S3               |

### Monitoring

- **Metrics**: Prometheus + Grafana
- **Logs**: OpenTelemetry → Loki/ELK
- **Tracing**: OpenTelemetry → Jaeger/Honeycomb
- **Errors**: Sentry (optional)

### Backup Strategy

- **Database**: Automated daily backups with PITR
- **Storage**: S3 versioning + cross-region replication (within compliance)
- **Redis**: RDB snapshots (cache only, not critical)

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker images
        # ... docker build and push
      - name: Run migrations
        # ... prisma migrate deploy
      - name: Deploy to Kubernetes
        # ... kubectl apply
```

## Troubleshooting

### Database Connection Issues

```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Check migrations status
npx prisma migrate status
```

### Redis Connection Issues

```bash
# Check connection
redis-cli -u $REDIS_URL PING
```

### Storage Issues

```bash
# Check bucket access
aws s3 ls s3://relay-us-west-media/
```

### Common Errors

| Error             | Cause                    | Solution                |
| ----------------- | ------------------------ | ----------------------- |
| `ECONNREFUSED`    | Service not running      | Check Docker containers |
| `P1001`           | Database unreachable     | Check DATABASE_URL      |
| `Invalid API key` | Key not found or expired | Regenerate API key      |
| `CORS error`      | Origin not allowed       | Check CORS_ORIGIN       |
