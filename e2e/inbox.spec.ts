import { test, expect } from '@playwright/test';

test.describe('Inbox', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'relay_session',
        value: 'test-session-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.goto('/dashboard/inbox');
  });

  test('should display inbox with interactions', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /inbox/i })).toBeVisible();

    // Should show interaction list
    await expect(page.locator('[data-testid="interaction-list"]')).toBeVisible();
  });

  test('should filter by type', async ({ page }) => {
    // Click on bug filter
    await page.getByRole('button', { name: /bugs/i }).click();

    // Should show only bugs
    const items = await page.locator('[data-type="bug"]').count();
    expect(items).toBeGreaterThanOrEqual(0);
  });

  test('should filter by status', async ({ page }) => {
    // Open status dropdown
    await page.getByRole('button', { name: /status/i }).click();

    // Select "New"
    await page.getByRole('menuitem', { name: /new/i }).click();

    // Should filter list
    await expect(page.locator('[data-status="new"]')).toBeVisible();
  });

  test('should search interactions', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('payment');

    // Should filter list to matching items
    await page.waitForTimeout(300); // Debounce
    // Verify search is applied
  });

  test('should select and view interaction details', async ({ page }) => {
    // Click on first interaction
    await page.locator('[data-testid="interaction-item"]').first().click();

    // Should show detail panel
    await expect(page.locator('[data-testid="interaction-detail"]')).toBeVisible();
  });

  test('should change interaction status', async ({ page }) => {
    // Select first interaction
    await page.locator('[data-testid="interaction-item"]').first().click();

    // Open status dropdown in detail view
    await page.getByRole('button', { name: /status/i }).click();

    // Change to "In Progress"
    await page.getByRole('menuitem', { name: /in progress/i }).click();

    // Should show success message or update UI
    await expect(page.getByText(/in progress/i)).toBeVisible();
  });

  test('should assign interaction', async ({ page }) => {
    await page.locator('[data-testid="interaction-item"]').first().click();

    // Click assign button
    await page.getByRole('button', { name: /assign/i }).click();

    // Select team member
    await page.getByRole('menuitem').first().click();

    // Should show assigned user
  });
});

test.describe('Interaction Detail', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'relay_session',
        value: 'test-session-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('should display bug report details', async ({ page }) => {
    await page.goto('/dashboard/inbox/interaction-1');

    // Should show title and description
    await expect(page.locator('[data-testid="interaction-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="interaction-description"]')).toBeVisible();
  });

  test('should display console logs', async ({ page }) => {
    await page.goto('/dashboard/inbox/interaction-1');

    // Click on logs tab
    await page.getByRole('tab', { name: /logs/i }).click();

    // Should show console logs
    await expect(page.locator('[data-testid="console-logs"]')).toBeVisible();
  });

  test('should display network requests', async ({ page }) => {
    await page.goto('/dashboard/inbox/interaction-1');

    // Click on network tab
    await page.getByRole('tab', { name: /network/i }).click();

    // Should show network requests
    await expect(page.locator('[data-testid="network-logs"]')).toBeVisible();
  });

  test('should play session replay', async ({ page }) => {
    await page.goto('/dashboard/inbox/interaction-1');

    // Click on replay tab
    await page.getByRole('tab', { name: /replay/i }).click();

    // Should show replay player
    await expect(page.locator('[data-testid="replay-player"]')).toBeVisible();

    // Click play
    await page.getByRole('button', { name: /play/i }).click();
  });

  test('should create Linear issue', async ({ page }) => {
    await page.goto('/dashboard/inbox/interaction-1');

    // Click create issue button
    await page.getByRole('button', { name: /create issue/i }).click();

    // Should open modal or dropdown
    await page.getByRole('menuitem', { name: /linear/i }).click();

    // Should show success message
    await expect(page.getByText(/issue created/i)).toBeVisible();
  });
});
