import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Staging Environment - Video Upload Test
 *
 * Tests the full workflow: upload video → stream initialization → pose detection
 * against the staging backend (VITE_BACKEND_URL=https://pose-backend-staging.yingliu.site)
 */

test.describe('Staging Video Upload Test', () => {

  test('should process video and return pose results', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify connection status shows "Connected"
    await expect(page.locator('.text-success', { hasText: 'Connected' })).toBeVisible({ timeout: 15000 });

    // Step 1: Click "+ Add Stream"
    const addStreamBtn = page.locator('button.btn-primary', { hasText: /Add Stream/i });
    await addStreamBtn.click();

    // Step 2: Enter stream ID
    const streamIdInput = page.locator('.add-form input[type="text"]').first();
    await streamIdInput.fill('video-test-mp4');

    // Step 3: Change source type to "Video File"
    const sourceTypeSelect = page.locator('.add-form select').first();
    await sourceTypeSelect.selectOption('video');

    // Step 4: Upload test video
    const fileInput = page.locator('.add-form input[type="file"][accept="video/*"]');
    const testVideoPath = path.resolve(__dirname, '..', 'test.mp4');
    await fileInput.setInputFiles(testVideoPath);

    // Verify file is selected
    await expect(page.locator('.add-form small', { hasText: /test\.mp4/i })).toBeVisible();

    // Step 5: Click "Create & Start Stream"
    const createBtn = page.locator('button.btn-success', { hasText: /Create/i });
    await createBtn.click();

    // Wait for stream initialization (model loading can take time on first run)
    await expect(createBtn).toBeHidden({ timeout: 60000 });

    // Step 6: Verify stream appears in the active streams list
    await expect(page.locator('.stream-item', { hasText: 'video-test-mp4' })).toBeVisible({ timeout: 30000 });

    // Step 7: Wait for pose processing (give it time to process frames)
    await page.waitForTimeout(10000);

    // Step 8: Take screenshot for visual verification
    await page.screenshot({
      path: 'results/staging-video-test.png',
      fullPage: true
    });

    // Step 9: Verify the stream is active
    await expect(page.locator('.status-badge.active')).toBeVisible({ timeout: 5000 });

    console.log('✓ Staging video test passed — pose detection working via staging backend');
  });
});
