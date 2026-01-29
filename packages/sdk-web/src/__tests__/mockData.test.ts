// ============================================================================
// MOCK DATA TESTS
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  getMockConversations,
  getMockMessages,
  getMockRoadmap,
  toggleMockVote,
  addMockMessage,
  createMockConversation,
} from "../ui/mockData";

describe("Mock Data", () => {
  describe("getMockConversations", () => {
    it("returns an array of conversations", () => {
      const conversations = getMockConversations();
      expect(Array.isArray(conversations)).toBe(true);
      expect(conversations.length).toBeGreaterThan(0);
    });

    it("conversations have required properties", () => {
      const conversations = getMockConversations();
      const conv = conversations[0];

      expect(conv).toHaveProperty("id");
      expect(conv).toHaveProperty("subject");
      expect(conv).toHaveProperty("lastMessage");
      expect(conv).toHaveProperty("unreadCount");
      expect(conv).toHaveProperty("createdAt");
    });
  });

  describe("getMockMessages", () => {
    it("returns messages for a valid conversation ID", () => {
      const conversations = getMockConversations();
      const messages = getMockMessages(conversations[0].id);

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
    });

    it("messages have required properties", () => {
      const conversations = getMockConversations();
      const messages = getMockMessages(conversations[0].id);
      const msg = messages[0];

      expect(msg).toHaveProperty("id");
      expect(msg).toHaveProperty("body");
      expect(msg).toHaveProperty("direction");
      expect(msg).toHaveProperty("createdAt");
      expect(["inbound", "outbound"]).toContain(msg.direction);
    });

    it("returns empty array for invalid conversation ID", () => {
      const messages = getMockMessages("invalid-id");
      expect(messages).toEqual([]);
    });
  });

  describe("getMockRoadmap", () => {
    it("returns an array of roadmap items", () => {
      const items = getMockRoadmap();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it("roadmap items have required properties", () => {
      const items = getMockRoadmap();
      const item = items[0];

      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("voteCount");
      expect(item).toHaveProperty("hasVoted");
      expect(["planned", "in_progress", "shipped"]).toContain(item.status);
    });
  });

  describe("toggleMockVote", () => {
    it("toggles vote state on roadmap items", () => {
      const items = getMockRoadmap();
      const itemId = items[0].id;
      const initialVoted = items[0].hasVoted;
      const initialCount = items[0].voteCount;

      toggleMockVote(itemId);

      const updatedItems = getMockRoadmap();
      const updatedItem = updatedItems.find((i) => i.id === itemId);

      expect(updatedItem?.hasVoted).toBe(!initialVoted);
      expect(updatedItem?.voteCount).toBe(
        initialVoted ? initialCount - 1 : initialCount + 1,
      );
    });
  });

  describe("addMockMessage", () => {
    it("adds a message to a conversation", () => {
      const conversations = getMockConversations();
      const convId = conversations[0].id;
      const initialCount = getMockMessages(convId).length;

      addMockMessage(convId, "Test message");

      const messages = getMockMessages(convId);
      expect(messages.length).toBe(initialCount + 1);
      expect(messages[messages.length - 1].body).toBe("Test message");
    });
  });

  describe("createMockConversation", () => {
    it("creates a new conversation with message", () => {
      const initialCount = getMockConversations().length;

      const conv = createMockConversation("Test Subject", "First message");

      expect(conv).toHaveProperty("id");
      expect(conv.subject).toBe("Test Subject");
      expect(conv.lastMessage?.body).toBe("First message");

      const conversations = getMockConversations();
      expect(conversations.length).toBe(initialCount + 1);
    });
  });
});
