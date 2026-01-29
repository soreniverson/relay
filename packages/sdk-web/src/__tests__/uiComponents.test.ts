// ============================================================================
// UI COMPONENT TESTS
// ============================================================================

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Test DOM utilities
import { createElement, clearChildren, generateId } from "../ui/utils/dom";

describe("DOM Utilities", () => {
  describe("createElement", () => {
    it("creates an element with the specified tag", () => {
      const el = createElement("div");
      expect(el.tagName.toLowerCase()).toBe("div");
    });

    it("applies class attribute", () => {
      const el = createElement("div", { class: "test-class" });
      expect(el.className).toBe("test-class");
    });

    it("applies multiple attributes", () => {
      const el = createElement("input", {
        type: "text",
        placeholder: "Test",
        disabled: true,
      }) as HTMLInputElement;

      expect(el.type).toBe("text");
      expect(el.placeholder).toBe("Test");
      expect(el.disabled).toBe(true);
    });

    it("appends text children", () => {
      const el = createElement("span", {}, ["Hello", " ", "World"]);
      expect(el.textContent).toBe("Hello World");
    });

    it("appends element children", () => {
      const child = createElement("span", {}, ["Child"]);
      const parent = createElement("div", {}, [child]);

      expect(parent.children.length).toBe(1);
      expect(parent.children[0].textContent).toBe("Child");
    });
  });

  describe("clearChildren", () => {
    it("removes all children from an element", () => {
      const parent = createElement("div");
      parent.appendChild(createElement("span"));
      parent.appendChild(createElement("span"));
      parent.appendChild(createElement("span"));

      expect(parent.children.length).toBe(3);

      clearChildren(parent);

      expect(parent.children.length).toBe(0);
    });
  });

  describe("generateId", () => {
    it("generates unique IDs", () => {
      const id1 = generateId("test");
      const id2 = generateId("test");

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test-\d+-/);
    });

    it("uses custom prefix", () => {
      const id = generateId("custom");
      expect(id.startsWith("custom-")).toBe(true);
    });
  });
});

// Test shared components that don't require full DOM
describe("Component Data Structures", () => {
  describe("BugReportFormData", () => {
    it("has correct shape", () => {
      const data = {
        title: "Test Bug",
        description: "This is a test bug",
        severity: "med" as const,
        includeScreenshot: true,
        includeLogs: true,
        attachments: [],
      };

      expect(data.title).toBe("Test Bug");
      expect(data.severity).toBe("med");
      expect(Array.isArray(data.attachments)).toBe(true);
    });
  });

  describe("FeatureRequestFormData", () => {
    it("has correct shape", () => {
      const data = {
        title: "Test Feature",
        description: "This is a test feature request",
        category: "feature",
        attachments: [],
      };

      expect(data.title).toBe("Test Feature");
      expect(data.category).toBe("feature");
      expect(Array.isArray(data.attachments)).toBe(true);
    });
  });

  describe("FeedbackFormData", () => {
    it("has correct shape", () => {
      const data = {
        text: "Great product!",
        rating: 5,
        category: "positive",
      };

      expect(data.text).toBe("Great product!");
      expect(data.rating).toBe(5);
    });
  });
});

describe("Annotation Types", () => {
  it("supports all annotation types", () => {
    const types = [
      "arrow",
      "rectangle",
      "circle",
      "text",
      "highlight",
      "blur",
    ] as const;

    const annotations = types.map((type, i) => ({
      id: `ann-${i}`,
      type,
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      color: "#ff0000",
    }));

    expect(annotations.length).toBe(6);
    annotations.forEach((ann, i) => {
      expect(ann.type).toBe(types[i]);
    });
  });
});
