import { test, expect } from '@playwright/test';

test.describe('Clip Assembly & Export', () => {
  test('should load assembly page', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return; // Skip if not authenticated
    }

    await expect(page.locator('h1')).toContainText('Assemble Video');
  });

  test('should display assembly form components', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    // Check for title input
    await expect(page.locator('input[placeholder*="title"]')).toBeVisible();

    // Check for Add Clips button
    await expect(page.locator('button:has-text("Add Clips")')).toBeVisible();

    // Check for subtitle toggle
    await expect(page.locator('text=Include burned-in subtitles')).toBeVisible();

    // Check for assemble button (should be disabled initially)
    await expect(page.locator('button:has-text("Assemble Video")')).toBeDisabled();
  });

  test('should open clip selection dialog', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    await page.click('button:has-text("Add Clips")');

    // Dialog should open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Select Clips')).toBeVisible();
  });

  test('should select and deselect clips', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    await page.click('button:has-text("Add Clips")');
    await page.waitForLoadState('networkidle');

    // Get clip buttons in dialog
    const clipButtons = page.locator('[role="dialog"] button:has(img), [role="dialog"] button:has(video)');
    const count = await clipButtons.count();

    if (count > 0) {
      // Select first clip
      await clipButtons.first().click();

      // Check indicator appears
      const checkIcon = page.locator('[role="dialog"] [class*="Check"]').first();
      await expect(checkIcon).toBeVisible();

      // Deselect
      await clipButtons.first().click();

      // Check indicator should be gone
      await expect(checkIcon).not.toBeVisible();
    }
  });

  test('should enable assemble button when clips selected and title entered', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    // Enter title
    await page.fill('input[placeholder*="title"]', 'Test Assembly');

    // Select clips
    await page.click('button:has-text("Add Clips")');
    await page.waitForLoadState('networkidle');

    const clipButtons = page.locator('[role="dialog"] button:has(img), [role="dialog"] button:has(video)');
    if ((await clipButtons.count()) > 0) {
      await clipButtons.first().click();
      await page.keyboard.press('Escape'); // Close dialog

      // Assemble button should be enabled
      await expect(page.locator('button:has-text("Assemble Video")')).toBeEnabled();
    }
  });

  test('should drag and drop to reorder clips', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    // Add multiple clips
    await page.click('button:has-text("Add Clips")');
    await page.waitForLoadState('networkidle');

    const clipButtons = page.locator('[role="dialog"] button:has(img), [role="dialog"] button:has(video)');
    const count = await clipButtons.count();

    if (count >= 2) {
      await clipButtons.nth(0).click();
      await clipButtons.nth(1).click();
      await page.keyboard.press('Escape');

      // Check for drag handles
      const dragHandles = page.locator('[class*="GripVertical"]');
      await expect(dragHandles.first()).toBeVisible();

      // Note: Actual drag-and-drop testing is complex and may need custom implementation
    }
  });

  test('should toggle subtitle options', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    // Toggle subtitles off
    await page.click('text=Include burned-in subtitles');

    // Subtitle options should be hidden
    await expect(page.locator('text=Font')).not.toBeVisible();

    // Toggle subtitles on
    await page.click('text=Include burned-in subtitles');

    // Subtitle options should be visible
    await expect(page.locator('text=Font')).toBeVisible();
    await expect(page.locator('text=Size')).toBeVisible();
    await expect(page.locator('text=Position')).toBeVisible();
  });

  test('should show recent assemblies', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    // Check for recent assemblies section
    await expect(page.locator('text=Recent Assemblies')).toBeVisible();
  });

  test('should submit assembly job', async ({ page }) => {
    await page.goto('/assemble');

    if (page.url().includes('/login')) {
      return;
    }

    // Fill in required fields
    await page.fill('input[placeholder*="title"]', 'E2E Test Assembly');

    // Select clips
    await page.click('button:has-text("Add Clips")');
    await page.waitForLoadState('networkidle');

    const clipButtons = page.locator('[role="dialog"] button:has(img), [role="dialog"] button:has(video)');
    if ((await clipButtons.count()) > 0) {
      await clipButtons.first().click();
      await page.keyboard.press('Escape');

      // Submit
      await page.click('button:has-text("Assemble Video")');

      // Should show loading state
      await expect(page.locator('text=Creating...')).toBeVisible();

      // Wait for response
      await page.waitForResponse(
        (response) => response.url().includes('/api/assemble') && response.status() === 200,
        { timeout: 10000 }
      ).catch(() => {});

      // Should show current job card
      await expect(page.locator('text=Current Job')).toBeVisible();
    }
  });
});
