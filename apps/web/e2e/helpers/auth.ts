import { Page } from '@playwright/test';

/**
 * Test user credentials for E2E tests
 * In a real scenario, these would be test accounts created specifically for E2E tests
 */
export const TEST_USER = {
  email: process.env.E2E_TEST_USER_EMAIL || 'test@example.com',
  password: process.env.E2E_TEST_USER_PASSWORD || 'testpassword123',
  name: 'Test User',
};

/**
 * Login as test user
 */
export async function loginAsTestUser(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

/**
 * Logout current user
 */
export async function logout(page: Page) {
  // Click user menu and logout - adjust selectors based on actual UI
  const userMenu = page.locator('[data-testid="user-menu"]');
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL('/login');
  }
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for presence of authenticated-only elements
  const dashboardNav = page.locator('nav a[href="/"]');
  return dashboardNav.isVisible();
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}
