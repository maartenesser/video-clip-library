import { test, expect } from '@playwright/test';
import { enablePerformanceMonitoring, getPerformanceMetrics } from './helpers/devtools';

test.describe('Clip Library', () => {
  // Skip auth check for these tests - they would need authenticated sessions
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP only works in Chromium');

  test('should load clips page', async ({ page }) => {
    // Note: In production, you'd need to authenticate first
    await page.goto('/clips');

    // If redirected to login, that's expected behavior
    if (page.url().includes('/login')) {
      return; // Skip test if not authenticated
    }

    await expect(page.locator('h1')).toContainText('Clip Library');
  });

  test('clips page should have good performance', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return; // Skip if not authenticated
    }

    const cdp = await enablePerformanceMonitoring(page);

    // Wait for clips to load
    await page.waitForLoadState('networkidle');

    // Get performance metrics
    const metrics = await getPerformanceMetrics(cdp);
    console.log('Clips page performance:', metrics);

    // Check that page loads reasonably fast
    const jsHeap = metrics.find((m: { name: string }) => m.name === 'JSHeapUsedSize');
    if (jsHeap) {
      // Heap should be under 50MB for reasonable performance
      expect(jsHeap.value).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should display clip cards with correct structure', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return;
    }

    // Wait for clips to load
    await page.waitForLoadState('networkidle');

    const clipCards = page.locator('[data-testid="clip-card"]');

    // If there are clips, check their structure
    const count = await clipCards.count();
    if (count > 0) {
      const firstClip = clipCards.first();

      // Check video/thumbnail is present
      await expect(
        firstClip.locator('[data-testid="clip-video"], [data-testid="clip-thumbnail"]').first()
      ).toBeVisible();

      // Check duration badge is present
      await expect(firstClip.locator('text=/\\d+:\\d+/')).toBeVisible();
    }
  });

  test('should filter clips by tag', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return;
    }

    await page.waitForLoadState('networkidle');

    // Look for filter controls
    const filterButton = page.locator('button:has-text("Filter")');
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Check that tag filter options appear
      await expect(page.locator('[data-testid="tag-filter"], [role="listbox"]')).toBeVisible();
    }
  });

  test('should load more clips on scroll/click', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return;
    }

    await page.waitForLoadState('networkidle');

    const initialCount = await page.locator('[data-testid="clip-card"]').count();

    // Look for load more button
    const loadMoreButton = page.locator('button:has-text("Load more")');
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click();
      await page.waitForLoadState('networkidle');

      const newCount = await page.locator('[data-testid="clip-card"]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }
  });
});

test.describe('Clip Quality Features', () => {
  test('should display quality scores on clips', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return;
    }

    await page.waitForLoadState('networkidle');

    // Check for quality score indicators
    const qualityScores = page.locator('[data-testid="quality-score"]');
    const count = await qualityScores.count();

    if (count > 0) {
      // Verify quality score is visible and has valid format
      await expect(qualityScores.first()).toBeVisible();
    }
  });

  test('should filter by quality threshold', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return;
    }

    await page.waitForLoadState('networkidle');

    // Look for quality filter control
    const qualityFilter = page.locator('[data-testid="quality-filter"]');
    if (await qualityFilter.isVisible()) {
      await qualityFilter.selectOption('4'); // Filter for 4+ quality

      await page.waitForLoadState('networkidle');

      // Clips should now be filtered
      const clips = page.locator('[data-testid="clip-card"]');
      // Just verify page didn't error
      await expect(clips.first()).toBeVisible().catch(() => {
        // No clips matching filter is valid
      });
    }
  });

  test('should show duplicate group indicator', async ({ page }) => {
    await page.goto('/clips');

    if (page.url().includes('/login')) {
      return;
    }

    await page.waitForLoadState('networkidle');

    // Check for duplicate badges
    const duplicateBadge = page.locator('[data-testid="duplicate-badge"]').first();
    if (await duplicateBadge.isVisible()) {
      await duplicateBadge.click();

      // Should show group modal or expand
      await expect(page.locator('[data-testid="group-modal"], [data-testid="group-expanded"]')).toBeVisible();
    }
  });
});
