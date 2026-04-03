import { test, expect } from '@playwright/test';

/**
 * Avatar Voice Control — E2E smoke tests
 *
 * Validates the new function-based UI and the Avatar Voice Control view.
 * Selectors aligned with Controls.tsx + ChatPanel.tsx + RoboticControlView.tsx.
 */

test.describe('Avatar Voice Control', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load app and show connected status', async ({ page }) => {
    await expect(page).toHaveTitle(/Pose Spatial Studio/i);
    await expect(page.locator('.connection-status')).toBeVisible();
    await expect(page.locator('text=Connected').first()).toBeVisible({ timeout: 15_000 });
  });

  test('should display function menu with all 5 functions', async ({ page }) => {
    const items = page.locator('.function-item');
    await expect(items).toHaveCount(5);

    // Verify labels
    await expect(items.nth(0)).toContainText('2D Pose Estimation');
    await expect(items.nth(1)).toContainText('3D Pose Estimation');
    await expect(items.nth(2)).toContainText('Object Detection');
    await expect(items.nth(3)).toContainText('Hand Gesture Recognition');
    await expect(items.nth(4)).toContainText('Avatar Voice Control');
  });

  test('should select Avatar Voice Control and show voice view', async ({ page }) => {
    // Click Avatar Voice Control function
    const voiceItem = page.locator('.function-item', { hasText: 'Avatar Voice Control' });
    await voiceItem.click();

    // Should be marked active
    await expect(voiceItem).toHaveClass(/active/);

    // Should NOT show source section (processorType is null)
    await expect(page.locator('.source-section')).not.toBeVisible();

    // System info should show the function name
    await expect(page.locator('.info-item', { hasText: 'Avatar Voice Control' })).toBeVisible();
  });

  test('should render chat panel with input field', async ({ page }) => {
    // Select Avatar Voice Control
    await page.locator('.function-item', { hasText: 'Avatar Voice Control' }).click();

    // Chat panel header "Voice Chat" should be visible
    await expect(page.locator('text=Voice Chat')).toBeVisible();

    // Empty state message
    await expect(page.locator('text=Say a command to control the avatar')).toBeVisible();

    // Text input with placeholder
    const input = page.locator('input[placeholder="Type a command..."]');
    await expect(input).toBeVisible();

    // Session timer should be visible (format M:SS)
    await expect(page.locator('text=/\\d:\\d{2}/')).toBeVisible();
  });

  test('should render 3D canvas in voice view', async ({ page }) => {
    test.setTimeout(30_000);

    // Collect WebGL errors
    const webglErrors: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('WebGL context could not be created')) {
        webglErrors.push(msg.text());
      }
    });

    // Select Avatar Voice Control
    await page.locator('.function-item', { hasText: 'Avatar Voice Control' }).click();

    // Wait for Three.js canvas to render
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // No WebGL errors
    expect(webglErrors).toHaveLength(0);

    // Canvas should have rendered content (not blank)
    await page.waitForTimeout(2_000);
    const screenshot = await canvas.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(2_000);
  });

  test('should type in chat input and show send button', async ({ page }) => {
    // Select Avatar Voice Control
    await page.locator('.function-item', { hasText: 'Avatar Voice Control' }).click();

    const input = page.locator('input[placeholder="Type a command..."]');
    await input.fill('wave right hand');
    await expect(input).toHaveValue('wave right hand');

    // Send button (↑) should appear when text is entered
    // The send button uses ↑ character
    const sendBtn = page.locator('button', { hasText: '↑' });
    await expect(sendBtn).toBeVisible();
  });

  test('should switch between functions without errors', async ({ page }) => {
    // Select Avatar Voice Control
    await page.locator('.function-item', { hasText: 'Avatar Voice Control' }).click();
    await expect(page.locator('text=Voice Chat')).toBeVisible();

    // Switch to 3D Pose
    await page.locator('.function-item', { hasText: '3D Pose Estimation' }).click();
    await expect(page.locator('text=Voice Chat')).not.toBeVisible();
    // Source section should appear (3D pose needs camera)
    await expect(page.locator('.source-section')).toBeVisible();

    // Switch back to Avatar Voice Control
    await page.locator('.function-item', { hasText: 'Avatar Voice Control' }).click();
    await expect(page.locator('text=Voice Chat')).toBeVisible();
    await expect(page.locator('.source-section')).not.toBeVisible();
  });

  test('screenshot: avatar voice control view', async ({ page }) => {
    test.setTimeout(30_000);

    await page.locator('.function-item', { hasText: 'Avatar Voice Control' }).click();
    await page.waitForTimeout(3_000); // Let 3D scene render

    await page.screenshot({
      path: 'results/avatar-voice-control.png',
      fullPage: true,
    });
  });
});
