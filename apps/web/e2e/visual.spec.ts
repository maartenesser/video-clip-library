import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('login page matches snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('signup page matches snapshot', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('signup-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('forgot password page matches snapshot', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('forgot-password-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  // These tests require authentication
  test.describe('Authenticated Pages', () => {
    test.skip(true, 'Requires authentication setup');

    test('clips page matches snapshot', async ({ page }) => {
      await page.goto('/clips');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('clips-page.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('chat page matches snapshot', async ({ page }) => {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('chat-page.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('assemble page matches snapshot', async ({ page }) => {
      await page.goto('/assemble');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('assemble-page.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });
  });
});

test.describe('Responsive Design', () => {
  test('login page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Form should still be visible and usable
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('login page is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('login-tablet.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});
