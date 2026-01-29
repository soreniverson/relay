import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
  });

  test('should show error for invalid email', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByPlaceholder(/email/i).fill('invalid-email');
    await page.getByRole('button', { name: /magic link/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('should accept valid email', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByPlaceholder(/email/i).fill('test@example.com');
    await page.getByRole('button', { name: /magic link/i }).click();

    // Should show success message
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test('should redirect to dashboard when authenticated', async ({ page, context }) => {
    // Set auth cookie
    await context.addCookies([
      {
        name: 'relay_session',
        value: 'test-session-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/dashboard');

    // Should not redirect to login
    await expect(page).toHaveURL(/dashboard/);
  });
});

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set auth cookie for all tests
    await context.addCookies([
      {
        name: 'relay_session',
        value: 'test-session-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('should navigate to inbox', async ({ page }) => {
    await page.goto('/dashboard/inbox');
    await expect(page.getByRole('heading', { name: /inbox/i })).toBeVisible();
  });

  test('should navigate to feedback', async ({ page }) => {
    await page.goto('/dashboard/feedback');
    await expect(page.getByRole('heading', { name: /feedback/i })).toBeVisible();
  });

  test('should navigate to roadmap', async ({ page }) => {
    await page.goto('/dashboard/roadmap');
    await expect(page.getByRole('heading', { name: /roadmap/i })).toBeVisible();
  });

  test('should navigate to surveys', async ({ page }) => {
    await page.goto('/dashboard/surveys');
    await expect(page.getByRole('heading', { name: /surveys/i })).toBeVisible();
  });

  test('should navigate to conversations', async ({ page }) => {
    await page.goto('/dashboard/conversations');
    await expect(page.getByRole('heading', { name: /conversations/i })).toBeVisible();
  });

  test('should navigate to settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });
});
