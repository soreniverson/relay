# Contributing to Relay

Thank you for your interest in contributing to Relay! This document provides guidelines and information for contributors.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community welcoming and inclusive.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/relay.git
   cd relay
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/your-org/relay.git
   ```

4. Install dependencies:
   ```bash
   pnpm install
   ```

5. Start infrastructure:
   ```bash
   docker-compose -f infra/local/docker-compose.yml up -d
   ```

6. Set up database:
   ```bash
   cp .env.example .env
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

7. Start development:
   ```bash
   pnpm dev
   ```

## Development Workflow

### Branching

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation changes

### Creating a Feature Branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

### Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new survey targeting options
fix: resolve session replay playback issue
docs: update API documentation
chore: upgrade dependencies
refactor: simplify interaction router
test: add tests for feedback voting
```

### Pull Requests

1. Ensure tests pass: `pnpm test`
2. Ensure linting passes: `pnpm lint`
3. Ensure types check: `pnpm typecheck`
4. Update documentation if needed
5. Add tests for new features
6. Fill out the PR template

### Code Review

- All PRs require at least one review
- Address review comments promptly
- Keep PRs focused and reasonably sized
- Squash commits before merging

## Project Structure

```
relay/
├── apps/
│   ├── web/              # Next.js dashboard
│   └── widget/           # Embeddable widget
├── services/
│   ├── api/              # tRPC API server
│   ├── worker/           # Background jobs
│   └── router/           # Edge router
├── packages/
│   ├── sdk-web/          # Web SDK
│   ├── sdk-ios/          # iOS SDK
│   ├── sdk-android/      # Android SDK
│   ├── shared/           # Shared types/utils
│   └── ui/               # UI components
├── infra/                # Infrastructure
├── docs/                 # Documentation
└── e2e/                  # E2E tests
```

## Coding Standards

### TypeScript

- Use strict mode
- Prefer `interface` over `type` for objects
- Use explicit return types for functions
- Avoid `any`, use `unknown` when needed

### React

- Functional components with hooks
- Use `'use client'` directive appropriately
- Prefer composition over prop drilling
- Use React.memo for expensive renders

### API

- Use Zod for input validation
- Return consistent error shapes
- Document all endpoints

### Testing

- Write tests for new features
- Maintain >80% coverage
- Use descriptive test names
- Test edge cases

## Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# E2E
pnpm test:e2e
```

## Documentation

- Update README for user-facing changes
- Update docs/ for feature documentation
- Add JSDoc comments for public APIs
- Include examples in documentation

## Issue Guidelines

### Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Screenshots/logs if applicable

### Feature Requests

Include:
- Problem statement
- Proposed solution
- Use cases
- Alternatives considered

## Security

Please report security vulnerabilities privately to security@relay.dev. Do not create public issues for security problems.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Create a [Discussion](https://github.com/your-org/relay/discussions)
- Join our [Discord](https://discord.gg/relay)
- Email: contribute@relay.dev

Thank you for contributing to Relay!
