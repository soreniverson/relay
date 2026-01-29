# Relay

**Full-featured in-app feedback, bug reporting, session replay, and customer support platform.**

Relay is an open-source alternative to Gleap, Usersnap, and similar tools. It provides everything you need to collect user feedback, track bugs, replay sessions, and support customers — all with built-in data residency.

## Features

### Core Capabilities

- **Bug Reporting**: Screenshot capture, annotations, console/network logs
- **Session Replay**: Full DOM replay using rrweb
- **Feedback Collection**: User feedback with voting and categorization
- **Live Chat**: Real-time customer support inbox
- **Surveys**: NPS, CSAT, and custom surveys with targeting
- **Roadmap**: Public/private product roadmap

### Platform Features

- **Multi-Region**: Data residency with isolated regional deployments
- **AI Assist**: Summaries, auto-labeling, duplicate detection
- **Integrations**: Linear, Slack (Jira, GitHub coming soon)
- **Privacy Controls**: PII masking, audit logs, data retention
- **SDKs**: Web, iOS, Android

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/relay.git
cd relay

# Copy environment files
cp .env.example .env

# Start infrastructure (PostgreSQL, Redis, MinIO)
docker-compose -f infra/local/docker-compose.yml up -d

# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start all services
pnpm dev
```

Access:

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **MinIO Console**: http://localhost:9001

Demo credentials: `admin@relay.dev` / `password123`

### Embed the Widget

```html
<script src="http://localhost:3001/widget.js"></script>
<script>
  Relay.init({
    apiKey: "rly_your_api_key", // From seed output
    environment: "development",
  });
</script>
```

Or with npm:

```bash
npm install @relay/sdk-web
```

```javascript
import Relay from "@relay/sdk-web";

Relay.init({
  apiKey: "rly_your_api_key",
  environment: "production",
  user: {
    id: "user_123",
    email: "user@example.com",
    name: "Jane Doe",
  },
});
```

## Project Structure

```
relay/
├── apps/
│   ├── web/              # Next.js admin dashboard
│   └── widget/           # Embeddable widget (bundled)
├── services/
│   ├── api/              # Express + tRPC API server
│   ├── worker/           # Async job processor
│   └── router/           # Edge router (optional)
├── packages/
│   ├── sdk-web/          # Web SDK
│   ├── sdk-ios/          # iOS SDK (Swift)
│   ├── sdk-android/      # Android SDK (Kotlin)
│   ├── shared/           # Shared types & validators
│   └── ui/               # Shared UI components
├── infra/
│   ├── local/            # Docker Compose for local dev
│   └── terraform/        # Infrastructure as code
└── docs/                 # Documentation
```

## Documentation

- [Architecture](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [API Reference](docs/api.md)
- [Web SDK](docs/sdk-web.md)
- [iOS SDK](docs/sdk-ios.md)
- [Android SDK](docs/sdk-android.md)
- [Replay System](docs/replay.md)
- [Privacy & Compliance](docs/privacy.md)
- [Deployment](docs/deploy.md)
- [Testing](docs/testing.md)
- [Runbooks](docs/runbooks.md)

## Technology Stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | Next.js 14, React, TypeScript, Tailwind, shadcn/ui |
| API      | Node.js, Express, tRPC, Prisma                     |
| Database | PostgreSQL 16                                      |
| Cache    | Redis 7                                            |
| Storage  | S3 / MinIO                                         |
| Queue    | Redis (Bull)                                       |
| Realtime | WebSocket                                          |
| Replay   | rrweb                                              |
| AI       | OpenAI (optional)                                  |

## Data Residency

Relay supports multi-region deployments where data never leaves its designated region:

- **US-West**: Oregon (us-west-2)
- **EU-West**: Ireland (eu-west-1)

Each region has isolated:

- PostgreSQL database
- Redis cache/queue
- S3-compatible storage
- Worker processes

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

```bash
# Run tests
pnpm test

# Run linting
pnpm lint

# Type check
pnpm typecheck

# Build all packages
pnpm build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/relay/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/relay/discussions)
- **Email**: support@relay.dev

---

Built with ❤️ for product teams who care about user feedback.
