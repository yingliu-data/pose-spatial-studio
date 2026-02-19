---
name: test
---

Run the validation suite for **$ARGUMENTS** (or full validation if no arguments given).

Execute steps in order. Steps 1, 2, 3, and 4 are **compulsory** — do NOT skip them.

**IMPORTANT — run from the correct project:** All tests MUST run from the **working project directory** (the project with your code changes), NOT from wherever this SKILL.md lives. If you have multiple project copies (e.g., `pose-spatial-studio` and `pose-spatial-studio-1`), always `cd` into the one with your active feature branch before running any commands.

**IMPORTANT — Do not make any changes in Staging and produc server from local project. It can only be done through GitHub CI/CD pipeline**
---

## Step 0: Pre-flight checks (compulsory)

Before running any tests, **kill all existing servers** to prevent stale/wrong backends from being reused:

```bash
pkill -f "app.py" 2>/dev/null; pkill -f "uvicorn" 2>/dev/null; pkill -f "run_server.sh" 2>/dev/null
pkill -f "vite" 2>/dev/null; pkill -f "run_ui.sh" 2>/dev/null
sleep 2
# Verify ports are free:
lsof -i :49101 2>&1; lsof -i :8585 2>&1
```

This is critical because Playwright's `reuseExistingServer: true` (the local default) will silently reuse any backend already running on port 49101 — even if it's from a different project copy. This causes false-positive test results.

---

## Step 1: Automated E2E tests (compulsory)

Run Playwright tests from the **working project's** `tests/` directory. Playwright auto-starts both backend (port 49101) and frontend (port 8585) via `webServer` config if they aren't already running.

**Run all tests:**
```bash
cd tests && npm test
```

**Run a single spec on Chromium (minimum bar):**
```bash
cd tests && npx playwright test specs/pose-validation.spec.ts --project=chromium
```

**Other commands:**
```bash
cd tests && npm run test:headed    # Visible browser
cd tests && npm run test:debug     # Debug with breakpoints
cd tests && npm run test:ui        # Interactive Playwright UI
cd tests && npm run test:report    # View HTML report after a run
```

**Test specs** live in `tests/specs/`:
| Spec | Purpose | Config |
|------|---------|--------|
| `pose-validation.spec.ts` | Main E2E suite — UI controls, video upload, pose detection | default |
| `staging-video-test.spec.ts` | Staging backend smoke test | `playwright.staging.config.ts` |

If tests fail, diagnose and fix before continuing.

**Visual verification** — after tests pass, examine screenshots in `tests/results/` using the Read tool and verify:
- `pose-validation-avatar.png` — **Avatar mode**: head is above hips, arms are in front of the body, legs are below hips
- `pose-validation-skeleton.png` — **Skeleton mode**: 3D skeleton is a reasonable human body shape and moves naturally
- Both screenshots should show the camera feed with a 2D skeleton overlay drawn on the image

---

## Step 2: Manual testing (ask for permission to go to step 3)

Use when automated tests are insufficient or you need additional verification. need user's confirmation to continue with next step

1. **Start dev environment** (if not already running):
   - Backend: `cd backend && ./run_server.sh` (port 49101)
   - Frontend: `cd frontend && ./run_ui.sh` (port 8585)
   - Confirm frontend connects to the **local** backend

2. **Test with video file** (no camera needed):
   - Open `http://localhost:8585`
   - Reject camera permission if prompted
   - **Add Stream** → Stream ID = `test` → Source Type = **Video File** → upload `tests/test.mp4`
   - Test each pose model: **MediaPipe**, **RTMPose**, **YOLO + TCPFormer**
   - Click **Create & Start Stream** → verify stream initiates → click **Play**

3. **Visual checks** (take screenshots and examine with Read tool):
   - Camera feed shows the human with a 2D skeleton overlay drawn on the image
   - **Skeleton mode**: 3D skeleton is a reasonable human body shape and moves naturally
   - **Avatar mode**: head is above hips, arms are in front of the body, legs are below hips. avatar is not jittering. the movement is like a human.
   - Pause → switch model via the stream overlay dropdown → Play → re-check all of the above

4. **Test with live camera** (when relevant):
   - Select a camera device instead of video file
   - Verify pose landmarks overlay and 3D skeleton/avatar respond in real time

---

## Step 3: Staging environment testing

Validate changes against the staging backend before production deployment.

**Staging infrastructure:**
- Backend container: `pose-spatial-studio-backend-staging` on VM2 port 49102
- Staging URL: `https://pose-backend-staging.yingliu.site`
- CI/CD: `deploy_backend_staging.yml` triggers on push to `staging` branch

**Workflow:**

1. Commit changes and create/merge PR to `staging` branch and approve merge
2. Wait for the **Deploy backend (staging)** GitHub Actions workflow to pass
3. Health check:
   ```bash
   curl -s https://pose-backend-staging.yingliu.site/health
   ```
4. Run frontend locally against staging backend and wait for user approval:
   ```bash
   cd frontend && VITE_BACKEND_URL=https://pose-backend-staging.yingliu.site npm run dev
   ```
5. **Test with video file:**
   - Open `http://localhost:8585`
   - Reject camera permission if prompted
   - **Add Stream** → Stream ID = `test` → Source Type = **Video File** → upload `tests/test.mp4`
   - Test each pose model: **MediaPipe**, **RTMPose**, **YOLO + TCPFormer**
   - Click **Create & Start Stream** → verify stream initiates → click **Play**
6.  run the automated staging test:
   ```bash
   cd frontend && VITE_BACKEND_URL=https://pose-backend-staging.yingliu.site npm run dev &
   cd tests && npx playwright test specs/staging-video-test.spec.ts --config=playwright.staging.config.ts --project=chromium
   ```
7. **Visual verification** — take a screenshot and examine with the Read tool:
   - Camera feed shows the human with a 2D skeleton overlay drawn on the image
   - **Skeleton mode**: 3D skeleton is a reasonable human body shape and moves naturally
   - **Avatar mode**: head is above hips, arms are in front of the body, legs are below hips
   - Pause → switch model via the stream overlay dropdown → Play → re-check all of the above
8. Check staging backend logs:
   ```bash
   ssh pose-backend "docker exec pose-spatial-studio-backend-staging tail -30 /root/backend/logs/app.log"
   ```

---

## Step 4: Remote GPU validation (compulsory) need user's confirmation to continue with next step

Verify the staging backend is healthy and GPU-accessible. This applies to **all changes** because the backend always runs on GPU infrastructure.

```bash
# Staging backend
ssh pose-backend "docker exec pose-spatial-studio-backend-staging curl -s http://localhost:49101/health"
ssh pose-backend "docker exec pose-spatial-studio-backend-staging tail -50 /root/backend/logs/app.log"

# Production backend
ssh pose-backend "docker exec pose-spatial-studio-backend curl -s http://localhost:49101/health"
ssh pose-backend "docker exec pose-spatial-studio-backend tail -50 /root/backend/logs/app.log"
```

**Visual verification** — run frontend against the production backend, take a screenshot, and examine with the Read tool:
1. `cd frontend && VITE_BACKEND_URL=https://pose-backend.yingliu.site npm run dev`
2. Open `http://localhost:8585` → **Add Stream** → Stream ID = `test` → Source Type = **Video File** → upload `tests/test.mp4`
3. Test each pose model: **MediaPipe**, **RTMPose**, **YOLO + TCPFormer**
4. Click **Create & Start Stream** → verify stream initiates → click **Play**
5. Verify via screenshot:
   - Camera feed shows the human with a 2D skeleton overlay drawn on the image
   - **Skeleton mode**: 3D skeleton is a reasonable human body shape and moves naturally
   - **Avatar mode**: head is above hips, arms are in front of the body, legs are below hips

See `/ssh-servers` skill for full remote debugging commands.

---

## Validation checklist

Before marking validation as complete, confirm ALL of the following:

- [ ] **Step 1** — Automated Playwright tests passed
- [ ] **Step 2** 
- [ ] **Step 3** — Staging environment tested (deployed, health check OK, pose detection works)
- [ ] **Step 4** — Remote GPU validation passed (health check + logs reviewed)
- [ ] Implementation meets all acceptance criteria

If any step fails → fix the issue and re-run from that step.

## After all test pass, continue with Update Documentation step in @develop/SKILL.md