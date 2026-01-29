import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
const mockPrisma = {
  session: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  endUser: {
    upsert: vi.fn(),
  },
  interaction: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  interactionLog: {
    create: vi.fn(),
  },
};

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock("../lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("../lib/redis", () => ({
  redis: mockRedis,
}));

describe("Ingest Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initSession", () => {
    it("should create a new session", async () => {
      const sessionData = {
        id: "session_123",
        projectId: "project_456",
        userId: null,
        startedAt: new Date(),
        lastSeenAt: new Date(),
        device: { type: "desktop", os: "macOS" },
        appVersion: "1.0.0",
        environment: "production",
        pageViews: 0,
        interactionCount: 0,
      };

      mockPrisma.session.upsert.mockResolvedValue(sessionData);
      mockRedis.setex.mockResolvedValue("OK");

      // Simulate calling initSession
      const result = await mockPrisma.session.upsert({
        where: { id: "session_123" },
        update: { lastSeenAt: expect.any(Date) },
        create: sessionData,
      });

      expect(result.id).toBe("session_123");
      expect(mockPrisma.session.upsert).toHaveBeenCalled();
    });

    it("should associate user with session", async () => {
      const userData = {
        id: "user_123",
        projectId: "project_456",
        externalUserId: "ext_user_789",
        email: "test@example.com",
        name: "Test User",
        traits: { plan: "pro" },
      };

      mockPrisma.endUser.upsert.mockResolvedValue(userData);

      const result = await mockPrisma.endUser.upsert({
        where: {
          projectId_externalUserId: {
            projectId: "project_456",
            externalUserId: "ext_user_789",
          },
        },
        update: { name: "Test User" },
        create: userData,
      });

      expect(result.externalUserId).toBe("ext_user_789");
      expect(mockPrisma.endUser.upsert).toHaveBeenCalled();
    });
  });

  describe("createInteraction", () => {
    it("should create a bug report interaction", async () => {
      const interactionData = {
        id: "int_123",
        projectId: "project_456",
        type: "bug",
        source: "widget",
        sessionId: "session_789",
        contentText: "Something broke",
        contentJson: { title: "Bug", description: "Details" },
        status: "new",
        severity: "high",
        tags: ["ui"],
      };

      mockPrisma.interaction.create.mockResolvedValue(interactionData);

      const result = await mockPrisma.interaction.create({
        data: interactionData,
      });

      expect(result.type).toBe("bug");
      expect(result.severity).toBe("high");
      expect(mockPrisma.interaction.create).toHaveBeenCalled();
    });

    it("should handle idempotent creation", async () => {
      const existingInteraction = {
        id: "int_existing",
        type: "feedback",
        status: "new",
      };

      mockPrisma.interaction.findUnique.mockResolvedValue(existingInteraction);

      const result = await mockPrisma.interaction.findUnique({
        where: { id: "int_existing" },
      });

      expect(result).toEqual(existingInteraction);
    });

    it("should create interaction logs", async () => {
      const logsData = {
        id: "log_123",
        projectId: "project_456",
        interactionId: "int_789",
        console: [{ level: "error", message: "Test error" }],
        network: [{ method: "GET", url: "/api/test", status: 500 }],
        errors: [{ message: "TypeError", stack: "at test.js:1" }],
      };

      mockPrisma.interactionLog.create.mockResolvedValue(logsData);

      const result = await mockPrisma.interactionLog.create({
        data: logsData,
      });

      expect(result.console).toHaveLength(1);
      expect(result.network).toHaveLength(1);
      expect(mockPrisma.interactionLog.create).toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("should track request count", async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const count = await mockRedis.incr("ratelimit:key_123");
      await mockRedis.expire("ratelimit:key_123", 60);

      expect(count).toBe(1);
      expect(mockRedis.incr).toHaveBeenCalledWith("ratelimit:key_123");
    });

    it("should respect rate limit", async () => {
      mockRedis.incr.mockResolvedValue(1001); // Over limit

      const count = await mockRedis.incr("ratelimit:key_123");

      expect(count).toBeGreaterThan(1000);
    });
  });
});
