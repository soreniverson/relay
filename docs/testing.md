# Relay Testing Guide

## Overview

Relay uses a comprehensive testing strategy with multiple layers:

- **Unit Tests**: Vitest for testing individual functions and modules
- **Integration Tests**: Testing API endpoints with mocked dependencies
- **E2E Tests**: Playwright for full browser-based testing

## Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run E2E tests
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

## Unit Tests

Unit tests are located alongside the code they test in `__tests__` directories.

### Example Test

```typescript
import { describe, it, expect } from "vitest";
import { generateId, maskEmail } from "../utils";

describe("generateId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe("maskEmail", () => {
  it("should mask email addresses", () => {
    expect(maskEmail("user@example.com")).toBe("u***@e***.com");
  });
});
```

### Mocking

We use Vitest's built-in mocking capabilities:

```typescript
import { vi, beforeEach } from "vitest";

// Mock a module
vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock a function
const mockFn = vi.fn().mockResolvedValue({ id: "123" });

beforeEach(() => {
  vi.clearAllMocks();
});
```

### Testing Async Code

```typescript
it("should handle async operations", async () => {
  const result = await someAsyncFunction();
  expect(result).toBe("expected");
});

it("should reject with error", async () => {
  await expect(failingAsyncFunction()).rejects.toThrow("error message");
});
```

## Integration Tests

Integration tests test API endpoints with real or mocked databases.

### Database Testing

```typescript
import { prisma } from "../lib/prisma";

describe("API Integration", () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$executeRaw`TRUNCATE TABLE interactions CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create interaction via API", async () => {
    const response = await fetch("/api/trpc/ingest.createInteraction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key",
      },
      body: JSON.stringify({
        type: "bug",
        source: "widget",
        contentText: "Test bug report",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.result.id).toBeDefined();
  });
});
```

## E2E Tests

E2E tests use Playwright to test the full application in a browser.

### Configuration

See `playwright.config.ts` for configuration options.

### Writing E2E Tests

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up authentication
    await context.addCookies([
      {
        name: "relay_session",
        value: "test-token",
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  test("should display inbox", async ({ page }) => {
    await page.goto("/dashboard/inbox");
    await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible();
  });

  test("should filter by status", async ({ page }) => {
    await page.goto("/dashboard/inbox");
    await page.getByRole("button", { name: /status/i }).click();
    await page.getByRole("menuitem", { name: /new/i }).click();
    // Assert filtered results
  });
});
```

### Page Object Pattern

For complex pages, use the Page Object pattern:

```typescript
// e2e/pages/inbox.page.ts
import { Page } from "@playwright/test";

export class InboxPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/dashboard/inbox");
  }

  async filterByStatus(status: string) {
    await this.page.getByRole("button", { name: /status/i }).click();
    await this.page.getByRole("menuitem", { name: status }).click();
  }

  async selectInteraction(index: number) {
    await this.page
      .locator('[data-testid="interaction-item"]')
      .nth(index)
      .click();
  }

  get interactionList() {
    return this.page.locator('[data-testid="interaction-list"]');
  }
}

// In test file
test("should work with page object", async ({ page }) => {
  const inbox = new InboxPage(page);
  await inbox.goto();
  await inbox.filterByStatus("new");
  await expect(inbox.interactionList).toBeVisible();
});
```

### Visual Regression Testing

```typescript
test("should match visual snapshot", async ({ page }) => {
  await page.goto("/dashboard/inbox");
  await expect(page).toHaveScreenshot("inbox.png");
});
```

## Test Coverage

Generate coverage reports with:

```bash
pnpm test:coverage
```

Coverage thresholds are configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

## CI/CD Integration

Tests run automatically on:

- Every push to `main`
- Every pull request

See `.github/workflows/ci.yml` for the full CI configuration.

## Test Data

### Seeding Test Data

```bash
# Seed test database
DATABASE_URL=postgresql://... pnpm db:seed

# Reset and re-seed
pnpm db:reset
```

### Test Fixtures

Use fixtures for consistent test data:

```typescript
// __tests__/fixtures/interactions.ts
export const mockBugReport = {
  id: "int_test_123",
  type: "bug",
  source: "widget",
  contentText: "Test bug report",
  status: "new",
  severity: "high",
};

export const mockFeedback = {
  id: "int_test_456",
  type: "feedback",
  source: "sdk",
  contentText: "Great product!",
  status: "new",
};
```

## Debugging Tests

### Vitest UI

```bash
pnpm test:ui
```

### Playwright Debug

```bash
# Run with headed browser
pnpm test:e2e -- --headed

# Debug mode
pnpm test:e2e -- --debug

# Generate code with Playwright Inspector
pnpm exec playwright codegen localhost:3000
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Keep Tests Independent**: Each test should be able to run in isolation
3. **Use Descriptive Names**: Test names should describe what they verify
4. **Avoid Test Interdependence**: Don't rely on test execution order
5. **Mock External Services**: Always mock external APIs and services
6. **Clean Up After Tests**: Reset state between tests
7. **Test Edge Cases**: Include tests for error conditions and edge cases
