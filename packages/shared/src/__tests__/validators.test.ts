import { describe, it, expect } from "vitest";
import {
  createInteractionSchema,
  createSessionSchema,
  createFeedbackItemSchema,
  idSchema,
  paginationSchema,
} from "../validators";

describe("Validators", () => {
  describe("idSchema", () => {
    it("should accept valid UUIDs", () => {
      const result = idSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      const result = idSchema.safeParse("not-a-uuid");
      expect(result.success).toBe(false);
    });

    it("should reject empty strings", () => {
      const result = idSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("paginationSchema", () => {
    it("should accept valid pagination params", () => {
      const result = paginationSchema.safeParse({
        page: 1,
        pageSize: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ page: 1, pageSize: 20 });
    });

    it("should use defaults when not provided", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("createSessionSchema", () => {
    const validDevice = {
      type: "desktop" as const,
      os: "macOS",
      browser: "Chrome",
    };

    it("should accept minimal valid input", () => {
      const result = createSessionSchema.safeParse({
        device: validDevice,
        environment: "production",
      });
      expect(result.success).toBe(true);
    });

    it("should accept full valid input", () => {
      const result = createSessionSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        device: validDevice,
        appVersion: "1.0.0",
        environment: "production",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid environment", () => {
      const result = createSessionSchema.safeParse({
        device: validDevice,
        environment: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createInteractionSchema", () => {
    const validSessionId = "550e8400-e29b-41d4-a716-446655440000";

    it("should accept valid bug report", () => {
      const result = createInteractionSchema.safeParse({
        type: "bug",
        source: "widget",
        sessionId: validSessionId,
        contentText: "Something is broken",
        severity: "high",
        tags: ["ui", "critical"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid feedback", () => {
      const result = createInteractionSchema.safeParse({
        type: "feedback",
        source: "sdk",
        sessionId: validSessionId,
        contentText: "Great product!",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid type", () => {
      const result = createInteractionSchema.safeParse({
        type: "invalid_type",
        source: "widget",
        sessionId: validSessionId,
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid severity", () => {
      const result = createInteractionSchema.safeParse({
        type: "bug",
        source: "widget",
        sessionId: validSessionId,
        severity: "super_high",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createFeedbackItemSchema", () => {
    it("should accept valid feedback item", () => {
      const result = createFeedbackItemSchema.safeParse({
        title: "Add dark mode",
        description: "Please add a dark mode option",
        category: "feature-request",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing title", () => {
      const result = createFeedbackItemSchema.safeParse({
        description: "Missing title",
      });
      expect(result.success).toBe(false);
    });
  });
});
