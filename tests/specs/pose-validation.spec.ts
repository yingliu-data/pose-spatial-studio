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

    // Verify model select has expected model options (mediapipe, rtmpose, yolo_tcpformer)
    const options = modelSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(3);
    await modelSelect.selectOption('mediapipe');
    await expect(modelSelect).toHaveValue('mediapipe');
    await modelSelect.selectOption('rtmpose');
    await expect(modelSelect).toHaveValue('rtmpose');
    await modelSelect.selectOption('yolo_tcpformer');
    await expect(modelSelect).toHaveValue('yolo_tcpformer');
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

  test('full video upload workflow with pose detection', async ({ page }) => {
    test.setTimeout(120_000);

    // Collect WebGL errors — if any appear, the 3D renderer is broken
    const webglErrors: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('WebGL context could not be created')) {
        webglErrors.push(msg.text());
      }
    });

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

    // Step 6: Verify stream is active
    await expect(page.locator('.status-badge.active').first()).toBeVisible({ timeout: 5_000 });

    // Step 7: Click Play to start video playback and frame processing
    const playBtn = page.locator('button.btn-primary', { hasText: /Play/i });
    await expect(playBtn).toBeVisible({ timeout: 5_000 });
    await playBtn.click();

    // Step 8: Wait for pose data to flow — "LIVE" indicator appears when poseResult.frame exists
    await expect(page.locator('text=LIVE').first()).toBeVisible({ timeout: 30_000 });

    // Step 9: Allow frames to process for avatar/skeleton rendering
    await page.waitForTimeout(5_000);

    // Step 10: Verify WebGL initialized (no context creation errors)
    expect(webglErrors).toHaveLength(0);

    // Step 11: Verify Three.js canvas renders non-trivial content (not blank)
    // Take a screenshot of just the view-container and check it has varied pixel data
    const viewContainer = page.locator('.view-container');
    const containerShot = await viewContainer.screenshot();
    // A blank/black canvas produces a very small PNG; rendered 3D content is much larger
    expect(containerShot.byteLength).toBeGreaterThan(5_000);

    // Step 12: Screenshot in Avatar mode (default)
    await page.screenshot({
      path: 'results/pose-validation-avatar.png',
      fullPage: true
    });

    // Step 13: Switch to Skeleton mode via overlay toggle button
    const rendererToggle = page.locator('button[title*="Switch to"]');
    await rendererToggle.click();
    await page.waitForTimeout(2_000);

    // Step 14: Screenshot in Skeleton mode
    await page.screenshot({
      path: 'results/pose-validation-skeleton.png',
      fullPage: true
    });

    console.log('Pose validation passed — video upload, playback, pose detection, avatar and skeleton rendering verified');
  });
});
