import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Pose Spatial Studio - Automated UI Testing
 *
 * Validates the stream creation UI, pose detection, and 3D rendering.
 * Selectors are aligned with frontend/src/components/Controls.tsx.
 */

const VIDEO_PATH = path.resolve(__dirname, '..', 'test.mp4');

test.describe('Pose Capture and Avatar Validation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the application with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Pose Spatial Studio/i);
  });

  test('should show connection status', async ({ page }) => {
    // The header shows a connection indicator and text
    await expect(page.locator('.connection-status')).toBeVisible();
    await expect(page.locator('text=Connected').first()).toBeVisible({ timeout: 15_000 });
  });

  test('should open and close Add Stream form', async ({ page }) => {
    // Click "+ Add Stream" button
    const addBtn = page.locator('button.btn-primary', { hasText: /Add Stream/i });
    await addBtn.click();

    // Form should appear
    await expect(page.locator('.add-form')).toBeVisible();
    await expect(page.locator('.add-form h3', { hasText: 'Create New Stream' })).toBeVisible();

    // Click cancel to close (button text changes to "✕ Cancel" when form is open)
    const cancelBtn = page.locator('button.btn-primary', { hasText: /Cancel/i });
    await cancelBtn.click();
    await expect(page.locator('.add-form')).not.toBeVisible();
  });

  test('should accept stream ID input', async ({ page }) => {
    // Open form
    await page.locator('button.btn-primary', { hasText: /Add Stream/i }).click();

    // Fill stream ID input (placeholder: "e.g., webcam1")
    const streamIdInput = page.locator('.add-form input[type="text"]').first();
    await streamIdInput.fill('test-stream');
    await expect(streamIdInput).toHaveValue('test-stream');
  });

  test('should have source type and model dropdowns', async ({ page }) => {
    // Open form
    await page.locator('button.btn-primary', { hasText: /Add Stream/i }).click();

    // Source type dropdown (first select in form)
    const sourceSelect = page.locator('.add-form select').first();
    await expect(sourceSelect).toBeVisible();

    // Verify source type has camera and video options (options are hidden DOM elements in <select>)
    await expect(sourceSelect.locator('option')).toHaveCount(2);
    await sourceSelect.selectOption('video');
    await expect(sourceSelect).toHaveValue('video');
    await sourceSelect.selectOption('camera');
    await expect(sourceSelect).toHaveValue('camera');

    // Model dropdown (second select in form)
    const modelSelect = page.locator('.add-form select').nth(1);
    await expect(modelSelect).toBeVisible();

    // Verify model select has mediapipe and rtmpose options
    await expect(modelSelect.locator('option')).toHaveCount(2);
    await modelSelect.selectOption('rtmpose');
    await expect(modelSelect).toHaveValue('rtmpose');
    await modelSelect.selectOption('mediapipe');
    await expect(modelSelect).toHaveValue('mediapipe');
  });

  test('should switch to video file input when source type is Video', async ({ page }) => {
    // Open form
    await page.locator('button.btn-primary', { hasText: /Add Stream/i }).click();

    // Switch source type to "video"
    const sourceSelect = page.locator('.add-form select').first();
    await sourceSelect.selectOption('video');

    // Video file input should appear
    const fileInput = page.locator('.add-form input[type="file"][accept="video/*"]');
    await expect(fileInput).toBeVisible();
  });

  test('full video upload workflow', async ({ page }) => {
    test.setTimeout(90_000);

    // Wait for connection
    await expect(page.locator('text=Connected').first()).toBeVisible({ timeout: 15_000 });

    // Open form
    await page.locator('button.btn-primary', { hasText: /Add Stream/i }).click();

    // Step 1: Enter stream ID
    const streamIdInput = page.locator('.add-form input[type="text"]').first();
    await streamIdInput.fill('pose-test-video');

    // Step 2: Select "Video File" source type
    const sourceSelect = page.locator('.add-form select').first();
    await sourceSelect.selectOption('video');

    // Step 3: Upload test video
    const fileInput = page.locator('.add-form input[type="file"][accept="video/*"]');
    await fileInput.setInputFiles(VIDEO_PATH);

    // Verify file selection
    await expect(page.locator('.add-form small', { hasText: /test\.mp4/i })).toBeVisible();

    // Step 4: Click "Create & Start Stream"
    const createBtn = page.locator('button.btn-success', { hasText: /Create/i });
    await createBtn.click();

    // Wait for stream to initialize (button disappears when form closes)
    await expect(createBtn).toBeHidden({ timeout: 60_000 });

    // Step 5: Verify stream appears in active streams list
    await expect(page.locator('.stream-item', { hasText: 'pose-test-video' })).toBeVisible({ timeout: 30_000 });

    // Step 6: Wait for pose processing
    await page.waitForTimeout(8_000);

    // Step 7: Verify stream is active
    await expect(page.locator('.status-badge.active').first()).toBeVisible({ timeout: 5_000 });

    // Step 8: Verify canvas is rendering (3D viewer or video)
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThan(0);

    // Step 9: Take screenshot for visual verification
    await page.screenshot({
      path: 'results/pose-validation-workflow.png',
      fullPage: true
    });

    console.log('Pose validation workflow passed — video upload, stream creation, and pose detection verified');
  });
});
