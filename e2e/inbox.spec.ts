import { test, expect } from "@playwright/test";

test.describe("Inbox", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: "relay_session",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/dashboard/inbox");
  });

  test("should display inbox page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible();
  });

  test("should show filter options", async ({ page }) => {
    // Should have type filter buttons
    await expect(page.getByRole("button", { name: /all/i })).toBeVisible();
  });
});
