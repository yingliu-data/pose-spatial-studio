---
name: develop
---

Accept user requirement **$ARGUMENTS** following the full development workflow.

## TODO List

After understanding the request (Step 1), **create a TODO list** using the `TodoWrite` tool with:
- One task for each acceptance criterion to implement
- One task for each affected file or component to build

Mark each task as `in_progress` when starting work on it, and `completed` immediately when finished. This systematic approach ensures all acceptance criteria are met and nothing is missed.

## Workflow Steps

1. **Understand** -- Analyze requirements and define acceptance criteria
2. **Branch** -- Create a properly named branch from the correct base
3. **Implement** -- Make changes following code conventions and lint standards
4. **Validate** -- Run automated tests (compulsory), staging tests (compulsory), manual checks (optional)
5. **Document** -- Update CHANGELOG.md, `.claude/PROJECT_STRUCTURE.md`, README.md as needed
6. **Review** -- Optionally run a developer review via `/code-review`
7. **Commit** -- Stage files and commit with conventional message format
8. **Push & PR** -- Push branch and create a pull request

---

## Step 1: Understand the Requirement

Thoroughly analyze the requirement by:
1. Breaking down the request into discrete components
2. Identifying acceptance criteria, dependencies, and any linked PRDs or designs
3. Using `AskUserQuestion` to clarify any ambiguities
4. Understand the project based on `.claude/PROJECT_STRUCTURE.md`

Document the following:
- Summary of the requirement
- Detailed description
- Acceptance criteria (what defines "done")
- Dependencies on other work
- Links to PRDs or design documents

---

## Step 2: Create Feature Branch

### Prepare the base

1. Read `.claude/PROJECT_STRUCTURE.md` to understand the project architecture
2. Identify which folder(s) will be affected by the changes
3. Fetch latest from remote:
   ```bash
   git fetch origin
   ```
4. Determine the base branch:
   - If one release branch exists, use it
   - If multiple exist, show the latest two and ask the user which to target using `AskUserQuestion` (mark the latest as "Recommended")

### Create the branch

For new features targeting production:
```bash
git checkout staging
git pull origin staging
git checkout -b type/brief-description
```

**Git flow:** `feature branch` → PR to `staging` → auto-deploy & test → PR to `main` → production

### Branch naming format: `type/brief-description`

| Type | Purpose | Example |
|------|---------|---------|
| `feat/` | New feature | `feat/avatar-creation` |
| `fix/` | Bug fix | `fix/pose-detection-issue` |
| `docs/` | Documentation | `docs/update-structure` |
| `wip/` | Work in progress | `wip/experiment-joint-rotation` |

**Naming rules:**
- Use lowercase letters only
- Separate words with hyphens (not underscores)
- Include ticket/issue key if applicable
- Keep description brief and descriptive

### Branching from in-progress work

When a ticket depends on another ticket still in code review, branch from that ticket's branch instead. After the base ticket is merged, rebase onto the target branch and force push with `--force-with-lease`.

---

## Step 3: Implement Changes

**Current default model**: MediaPipe (with GPU delegate). The backend processor is `processors/mediapipe_processor.py`. Alternative processors: RTMPose3D at `processors/rtmpose_processor.py`, YOLO-NAS-Pose at `processors/yolo_pose_processor.py` (config `processor_type: "yolo3d"`). Users can select the model from a dropdown in the stream creation form or switch models live via the overlay on the stream viewer. Available models are defined in `AVAILABLE_MODELS` in `frontend/src/App.tsx`.

Follow these guidelines during implementation:

1. **Code conventions**: Maintain consistent formatting and style with existing codebase
2. **Acceptance criteria**: Ensure all acceptance criteria from Step 1 are fully met
3. **Update TODO**: Mark tasks as `in_progress` when starting, `completed` when finished
4. **Test as you go**: Validate changes incrementally to catch issues early
5. **Optimize complexity**: Analyze and improve Big O time/space complexity where possible
6. **Lint check**: Run linters and code quality tools to ensure code meets project standards

### Frontend lint

```bash
cd frontend && npx tsc --noEmit
```

### Backend lint

Compile-check all modified Python files:
```bash
cd backend && python -m py_compile app.py
# Check modified processor files:
# python -m py_compile processors/mediapipe_processor.py
# python -m py_compile processors/base_processor.py
# python -m py_compile processors/image_processor.py
# Check core and util files:
# python -m py_compile core/websocket_handler.py
# python -m py_compile config.py
```

---

## Step 4: Validate

**IMPORTANT: Steps 4A, 4C, and 4D are ALL compulsory. You MUST run all three before proceeding to Step 5. Do NOT skip any of them.** Failure to run all three validation steps is a workflow violation.

### 4A: Automated testing (compulsory — MUST RUN)

Run Playwright E2E tests from the `tests/` directory. Playwright auto-starts both backend (port 49101) and frontend (port 8585) if they aren't already running.

```bash
cd tests && npm test
```

At minimum, run the mediapipe video test on chromium:
```bash
cd tests && npx playwright test specs/mediapipe-video-test.spec.ts --project=chromium
```

**Other test commands:**
```bash
npm run test:headed    # Run with visible browser
npm run test:debug     # Debug mode with breakpoints
npm run test:ui        # Interactive Playwright UI
npm run test:report    # View HTML report after a run
```
Test pose estimation performance by uploading tests/test.mp4 to initiate stream on UI and click play.
Test specs live in `tests/specs/`:
- `pose-validation.spec.ts` -- Main E2E test suite for pose detection
- `mediapipe-video-test.spec.ts` -- MediaPipe video input test
- `staging-video-test.spec.ts` -- Staging environment test (use with `playwright.staging.config.ts`)

When adding new features, consider adding or updating specs.

### 4B: Manual testing (optional)

If automated tests are insufficient or you need to test visually:

1. **Start the dev environment** (if not already running):
   - Backend: `cd backend && ./run_server.sh` (serves on `http://localhost:49101`)
   - Frontend: `cd frontend && ./run_ui.sh` (serves on `http://localhost:8585`)
   - Verify the frontend connects to the **local** backend (not production)

2. **Test with video file** (no camera needed):
   - Open `http://localhost:8585`
   - Enter a stream name (e.g. `test`)
   - Select the **Video** input option
   - Upload the test video at `tests/test.mp4`
   - Start the stream and verify pose detection + avatar rendering

3. **Test with live camera** (when relevant):
   - Open `http://localhost:8585`
   - Enter a stream name (e.g. `test`)
   - Select a camera device
   - Verify pose landmarks overlay and 3D skeleton/avatar respond

### 4C: Staging environment testing (compulsory — MUST RUN)

**You MUST run this step.** Use the staging environment to validate changes before production deployment.

**Staging infrastructure:**
- **Backend container**: `pose-spatial-studio-backend-staging` on VM2 port `49102`
- **Staging URL**: `https://pose-backend-staging.yingliu.site`
- **CI/CD**: `deploy_backend_staging.yml` triggers on push to `staging` branch
- **GitHub secret**: `VITE_STAGING_BACKEND_URL` = `https://pose-backend-staging.yingliu.site`

**Staging test workflow:**

1. Commit changes and create PR to `staging` branch
2. Merge PR — this triggers automatic deployment to the staging container
3. Wait for the `Deploy backend (staging)` GitHub Actions workflow to pass
4. Run frontend locally connected to staging backend:
   ```bash
   cd frontend && VITE_BACKEND_URL=https://pose-backend-staging.yingliu.site npm run dev
   ```
5. Open `http://localhost:8585`
6. Enter a stream name, select **Video**, upload `tests/test.mp4`
7. Click **Create & Start Stream**, press **Play**
8. Observe logs in frontend console and staging backend:
   ```bash
   ssh -o ProxyCommand="cloudflared access ssh --hostname %h" root@pose-backend-ssh.yingliu.site \
     "docker exec pose-spatial-studio-backend-staging tail -30 /root/backend/logs/app.log"
   ```
9. Take screenshot to verify pose detection works
10. If test passes → create PR from `staging` to `main` to trigger production deployment

**Automated staging test:**
```bash
cd frontend && VITE_BACKEND_URL=https://pose-backend-staging.yingliu.site npm run dev &
cd tests && npx playwright test specs/staging-video-test.spec.ts --config=playwright.staging.config.ts --project=chromium
```

**Staging health check:**
```bash
curl https://pose-backend-staging.yingliu.site/health
```


### 4D: Remote GPU validation (compulsory — MUST RUN)

**You MUST run this step.** Verify the staging backend is healthy and GPU-accessible after deployment. This applies to all changes, not just GPU-specific features, because the backend always runs on GPU infrastructure.

```bash
# Production backend
ssh -o ProxyCommand="cloudflared access ssh --hostname %h" root@pose-backend-ssh.yingliu.site
docker exec pose-spatial-studio-backend curl -s http://localhost:49101/health
docker exec pose-spatial-studio-backend tail -50 /root/backend/logs/app.log

# Staging backend
docker exec pose-spatial-studio-backend-staging curl -s http://localhost:49101/health
docker exec pose-spatial-studio-backend-staging tail -50 /root/backend/logs/app.log
```

See `/ssh-servers` skill for full remote debugging commands.

### Validate against acceptance criteria

Before proceeding, confirm ALL of the following:
- [ ] **4A** Automated Playwright tests passed
- [ ] **4C** Staging environment test passed (PR merged to staging, deployed, test run)
- [ ] **4D** Remote GPU validation passed (health check + logs reviewed)
- [ ] Implementation meets all acceptance criteria from Step 1

If any validation fails → Return to Step 3 and fix.
If all pass → Proceed to Step 5.

---

## Step 5: Update Documentation

Update the following documentation files as needed:

### 1. CHANGELOG.md
Add an entry to the appropriate `CHANGELOG.md` file:

**Format:**
```markdown
## <version> - <Day Month Year>

- <brief feature summary (under 10 words)>: <Title>
```

If the version section doesn't exist, create it at the top of the file.

### 2. `.claude/PROJECT_STRUCTURE.md`
If the changes affect project architecture (new files, moved directories, new processors), update `.claude/PROJECT_STRUCTURE.md` accordingly.

### 3. README.md
If the changes affect setup, usage, or dependencies, update the relevant `README.md` file.

### 4. TODO status
Mark all completed tasks in your TODO list as `completed` using `TodoWrite`.

### 5. Skill update
Update SKILL.md files in `.claude/skills/` based on the progress in the session, so skills adapt to the user's development workflow.

---

## Step 6: Developer Review (Optional)

Use `AskUserQuestion` to ask whether the user wants to run a Developer Review before committing:

**Question:** "Would you like to run a Developer Review before committing?"

**Options:**
- Yes (Recommended) -- Review changes against base branch to catch issues early
- No -- Skip review and proceed to commit

If the user selects "Yes", follow the process defined in `/code-review`.

---

## Step 7: Commit Changes

### Commit message format
Use conventional commits: `type: description`

| Type | Purpose | Example |
|------|---------|---------|
| `feat:` | New feature | `feat: add avatar joint rotation support` |
| `fix:` | Bug fix | `fix: resolve pose detection accuracy issue` |
| `docs:` | Documentation | `docs: update PROJECT_STRUCTURE.md` |
| `style:` | Formatting only | `style: fix indentation in pose module` |
| `refactor:` | Code restructuring | `refactor: extract avatar axis alignment logic` |
| `perf:` | Performance improvement | `perf: optimize skeleton rendering` |
| `test:` | Tests | `test: add unit tests for pose service` |
| `chore:` | Build/tooling | `chore: update Python dependencies` |

### Commit rules
1. **Stage specific files**: Use `git add <file>` for each file (avoid `git add -A` or `git add .`)
2. **Imperative mood**: Use "add" not "added", "fix" not "fixed"
3. **Length**: Keep under 72 characters
4. **No period**: Don't end with a period

---

## Step 8: Push Branch and Create Pull Request

### Rebase before push

Rebase onto the target branch to ensure a clean history:
```bash
git fetch origin
git rebase origin/staging
```
Resolve any conflicts before pushing.

### Push

```bash
git push -u origin <branch-name>
```

### Create PR

Use `gh pr create` CLI command.

**PR title**: Clear, descriptive, under 70 characters.
**Example:** `Add avatar joint rotation and axis alignment support`

**PR description** should include:
1. **Summary of changes**: Brief overview of what was implemented
2. **Link to issue/ticket**: Reference the original requirement or issue number
3. **Testing notes**: How to test the changes, steps to reproduce
4. **Screenshots**: Include screenshots for UI changes
5. **Acceptance criteria**: Confirm all criteria from Step 1 are met

---

## Pre-PR Checklist

Before creating the pull request, verify all of the following:

- [ ] All acceptance criteria from Step 1 are fully met
- [ ] All TODO tasks are marked as `completed`
- [ ] **4A** Playwright tests pass (`cd tests && npm test`) -- compulsory
- [ ] **4C** Staging environment tested and verified (merge to staging, deploy, run staging test) -- compulsory
- [ ] **4D** Remote GPU validation passed (health check + staging logs) -- compulsory
- [ ] Lint checks pass (`tsc --noEmit`, `py_compile`)
- [ ] Commit messages follow `type: description` format
- [ ] Branch name follows `type/brief-description` convention
- [ ] PR title is clear and descriptive
- [ ] Documentation updated (CHANGELOG.md, README.md, `.claude/PROJECT_STRUCTURE.md` as needed)
- [ ] No secrets, credentials, or sensitive data in committed code
- [ ] Code follows project conventions and existing patterns
- [ ] No unnecessary files added (temp files, IDE configs, build artifacts)
