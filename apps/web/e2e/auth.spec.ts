import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display login form correctly', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h2, [class*="CardTitle"]')).toContainText('Welcome back');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[class*="destructive"]')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.click('a[href="/signup"]');

    await expect(page).toHaveURL('/signup');
    await expect(page.locator('h2, [class*="CardTitle"]')).toContainText('Create an account');
  });

  test('should display signup form correctly', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.locator('input[type="text"]')).toBeVisible(); // Name field
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').last()).toBeVisible(); // Confirm password
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('should show error for password mismatch on signup', async ({ page }) => {
    await page.goto('/signup');

    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]').first().fill('password123');
    await page.fill('input[type="password"]').last().fill('differentpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('[class*="destructive"]')).toContainText('Passwords do not match');
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await page.click('a[href="/forgot-password"]');

    await expect(page).toHaveURL('/forgot-password');
    await expect(page.locator('h2, [class*="CardTitle"]')).toContainText('Forgot password');
  });

  test('should display forgot password form correctly', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });
});
