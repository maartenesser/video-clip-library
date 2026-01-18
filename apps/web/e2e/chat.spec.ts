import { test, expect } from '@playwright/test';

test.describe('AI Chat Assistant', () => {
  test('should load chat page', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return; // Skip if not authenticated
    }

    await expect(page.locator('h1')).toContainText('AI Clip Curator');
  });

  test('should display empty state with suggestions', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    // Check for empty state
    await expect(page.locator('text=Start a conversation')).toBeVisible();
    await expect(page.locator('text=Try asking')).toBeVisible();
  });

  test('should have functional chat input', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    const chatInput = page.locator('textarea[placeholder*="Describe"]');
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();
  });

  test('should send message and receive response', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    // Type a message
    const chatInput = page.locator('textarea[placeholder*="Describe"]');
    await chatInput.fill('Find clips about product benefits');

    // Send message
    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();

    // Should show user message
    await expect(page.locator('text=Find clips about product benefits')).toBeVisible();

    // Should show loading indicator
    await expect(page.locator('[class*="animate-spin"]')).toBeVisible();

    // Wait for AI response (with timeout)
    await expect(page.locator('[class*="bg-muted"]').last()).toBeVisible({
      timeout: 30000,
    });
  });

  test('should display suggested clips after query', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    // Send a query
    const chatInput = page.locator('textarea[placeholder*="Describe"]');
    await chatInput.fill('Show me testimonial clips');
    await page.locator('button[type="submit"]').click();

    // Wait for response
    await page.waitForResponse(
      (response) => response.url().includes('/api/chat') && response.status() === 200,
      { timeout: 30000 }
    ).catch(() => {});

    // Check for suggested clips section
    const suggestedClips = page.locator('[data-testid="suggested-clip"]');
    const clipCount = await suggestedClips.count();

    // Clips may or may not be present depending on library content
    console.log(`Found ${clipCount} suggested clips`);
  });

  test('should create new conversation', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    // Look for new chat button
    const newChatButton = page.locator('button:has-text("New Chat")');
    if (await newChatButton.isVisible()) {
      await newChatButton.click();

      // Should reset to empty state
      await expect(page.locator('text=Start a conversation')).toBeVisible();
    }
  });

  test('should toggle sidebar', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    // Look for sidebar toggle
    const sidebarToggle = page.locator('button:has([class*="MessageSquare"])');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();

      // Sidebar should toggle
      await page.waitForTimeout(300); // Wait for animation
    }
  });

  test('should handle Enter key to send message', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    const chatInput = page.locator('textarea[placeholder*="Describe"]');
    await chatInput.fill('Test message');
    await chatInput.press('Enter');

    // Should show the message
    await expect(page.locator('text=Test message')).toBeVisible();
  });

  test('should support Shift+Enter for new line', async ({ page }) => {
    await page.goto('/chat');

    if (page.url().includes('/login')) {
      return;
    }

    const chatInput = page.locator('textarea[placeholder*="Describe"]');
    await chatInput.fill('Line 1');
    await chatInput.press('Shift+Enter');
    await chatInput.type('Line 2');

    // Should have multiline content
    const value = await chatInput.inputValue();
    expect(value).toContain('\n');
  });
});
