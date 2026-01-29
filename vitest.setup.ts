import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/relay_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.REGION = 'us-west';
});

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});

// Cleanup
afterAll(() => {
  vi.restoreAllMocks();
});

// Global test utilities
global.createMockRequest = (options = {}) => {
  return {
    headers: new Map([['x-api-key', 'rly_test_123']]),
    body: {},
    ...options,
  };
};

global.createMockContext = (options = {}) => {
  return {
    prisma: {},
    redis: {},
    projectId: 'test-project-id',
    apiKeyId: 'test-key-id',
    ...options,
  };
};
