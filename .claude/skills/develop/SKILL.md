---
name: develop
---

Accept user requirement **$ARGUMENTS** following the full development workflow.

## TODO List

After understanding the request (Step 1), **create a TODO list** using the `TodoWrite` tool with:
- One task for each acceptance criterion to implement
- One task for each affected file or component to build

Mark each task as `in_progress` when starting work on it, and `completed` immediately when finished. This systematic approach ensures all acceptance criteria are met and nothing is missed.

## Workflow Overview

| Step | Action | Notes |
|------|--------|-------|
| 1 | **Understand** | Analyze requirements, define acceptance criteria |
| 2 | **Branch** | Create a properly named branch from the correct base |
| 3 | **Implement** | Make changes following code conventions and lint standards |
| 4 | **Validate** | Run all test steps — **ALL sub-steps are compulsory** |
| 5 | **Document** | Update CHANGELOG.md, PROJECT_STRUCTURE.md, README.md |
| 6 | **Review** | Optionally run a developer code review |
| 7 | **Commit** | Stage files and commit with conventional message format |
| 8 | **Push & PR** | Push branch and create pull request |

---

## Step 1: Understand the Requirement

Thoroughly analyze the requirement by:
1. Breaking down the request into discrete components
2. Identifying acceptance criteria, dependencies, and any linked PRDs or designs
3. Using `AskUserQuestion` to clarify any ambiguities
4. Reading [.claude/PROJECT_STRUCTURE.md](.claude/PROJECT_STRUCTURE.md) to understand the project architecture

Document the following:
- Summary of the requirement
- Detailed description
- Acceptance criteria (what defines "done")
- Dependencies on other work
- Links to PRDs or design documents

---

## Step 2: Create Feature Branch

### Prepare the base

1. Identify which folder(s) will be affected by the changes (refer to [.claude/PROJECT_STRUCTURE.md](.claude/PROJECT_STRUCTURE.md))
2. Fetch latest from remote:
   ```bash
   git fetch origin
   ```
3. Determine the base branch:
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

### Branch naming: `type/brief-description`

| Type | Purpose | Example |
|------|---------|---------|
| `feat/` | New feature | `feat/avatar-creation` |
| `fix/` | Bug fix | `fix/pose-detection-issue` |
| `docs/` | Documentation | `docs/update-structure` |
| `wip/` | Work in progress | `wip/experiment-joint-rotation` |

**Rules:** lowercase, hyphens (not underscores), include ticket key if applicable, keep it brief.

### Branching from in-progress work

When a ticket depends on another ticket still in code review, branch from that ticket's branch instead. After the base ticket is merged, rebase onto the target branch and force push with `--force-with-lease`.

---

## Step 3: Implement Changes

**Current default model:** MediaPipe (with GPU delegate). Backend processor: [backend/processors/mediapipe_processor.py](backend/processors/mediapipe_processor.py).

Alternative processors:
- RTMPose3D → [backend/processors/rtmpose_processor.py](backend/processors/rtmpose_processor.py) (`processor_type: "rtmpose"`)
- YOLO + TCPFormer → [backend/processors/yolo_tcpformer_processor.py](backend/processors/yolo_tcpformer_processor.py) (`processor_type: "yolo_tcpformer"`)

Available models are defined in `AVAILABLE_MODELS` in [frontend/src/App.tsx](frontend/src/App.tsx).

Follow these guidelines during implementation:

1. **Code conventions** — Maintain consistent formatting and style with existing codebase
2. **Acceptance criteria** — Ensure all acceptance criteria from Step 1 are fully met
3. **Update TODO** — Mark tasks as `in_progress` when starting, `completed` when finished
4. **Test as you go** — Validate changes incrementally to catch issues early
5. **Optimize complexity** — Analyze and improve Big O time/space complexity where possible
6. **Lint check** — Run linters after implementation (see below)

### Frontend lint

```bash
cd frontend && npx tsc --noEmit
```

### Backend lint

Compile-check all modified Python files:
```bash
cd backend && python -m py_compile app.py
# Also check any modified processor or core files, e.g.:
# python -m py_compile processors/mediapipe_processor.py
# python -m py_compile core/websocket_handler.py
# python -m py_compile config.py
```

---

## Step 4: Validate

> **MANDATORY — Read and follow [.claude/skills/test/SKILL.md](.claude/skills/test/SKILL.md) in full before continuing to Step 5.**
>
> Do NOT skip, abbreviate, or reorder any sub-step. The test skill defines four compulsory steps plus user-approval gates — all must be completed.

Execute the test skill steps in order:

| Test Step | What to do | Gate |
|-----------|-----------|------|
| **Step 0** Pre-flight | Kill all servers; verify ports 49101 and 8585 are free | — |
| **Step 1** Automated E2E | Run `cd tests && npm test`; verify screenshots in `tests/results/` | — |
| **Step 2** Manual testing | Start dev servers; test video file and camera with all three pose models | **Ask user for approval before continuing to Step 3** |
| **Step 3** Staging | Commit → PR to `staging` → wait for CI deploy → health check → run staging tests | — |
| **Step 4** Remote GPU | SSH health check + tail logs on staging and production backends | **Ask user for approval before continuing to Step 5** |

After all steps pass and the user approves, return here and continue to Step 5.

---

## Step 5: Update Documentation

Update the following files as needed:

### 1. [CHANGELOG.md](CHANGELOG.md)

Add an entry at the top of the appropriate `CHANGELOG.md`:

```markdown
## <version> - <Day Month Year>

- <brief feature summary (under 10 words)>: <Title>
```

If the version section doesn't exist, create it.

### 2. [.claude/PROJECT_STRUCTURE.md](.claude/PROJECT_STRUCTURE.md)

If changes affect project architecture (new files, moved directories, new processors), update this file accordingly.

### 3. [README.md](README.md)

If changes affect setup, usage, or dependencies, update the relevant `README.md`.

### 4. TODO status

Mark all completed tasks in your TODO list as `completed` using `TodoWrite`.

### 5. Skill update

Update any `.claude/skills/*/SKILL.md` files that are affected by workflow changes discovered during this session.

---

## Step 6: Developer Review (Optional)

Use `AskUserQuestion` to ask whether the user wants to run a Developer Review before committing:

**Question:** "Would you like to run a Developer Review before committing?"

**Options:**
- Yes (Recommended) — Review changes against base branch to catch issues early
- No — Skip review and proceed to commit

If the user selects "Yes", invoke the `code-review` skill using the `Skill` tool:
```
skill: "code-review"
```
This executes [.claude/skills/code-review/SKILL.md](.claude/skills/code-review/SKILL.md).

---

## Step 7: Commit Changes

### Commit message format: `type: description`

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

1. **Stage specific files** — Use `git add <file>` for each file (avoid `git add -A` or `git add .`)
2. **Imperative mood** — "add" not "added", "fix" not "fixed"
3. **Under 72 characters**
4. **No trailing period**

---

## Step 8: Push Branch and Create Pull Request

### Rebase before push

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

**PR title:** Clear, descriptive, under 70 characters.

**PR description** must include:
1. **Summary of changes** — Brief overview of what was implemented
2. **Link to issue/ticket** — Reference the original requirement or issue number
3. **Testing notes** — How to test the changes, steps to reproduce
4. **Screenshots** — Include screenshots for UI changes
5. **Acceptance criteria** — Confirm all criteria from Step 1 are met

---

## Pre-PR Checklist

Before creating the pull request, verify **every item**:

- [ ] All acceptance criteria from Step 1 are fully met
- [ ] All TODO tasks are marked as `completed`
- [ ] **Test Step 0** — Stale servers killed, ports verified free
- [ ] **Test Step 1** — Playwright E2E tests passed; screenshots reviewed
- [ ] **Test Step 2** — Manual testing completed; user approved
- [ ] **Test Step 3** — Staging deployed, health check OK, staging tests passed
- [ ] **Test Step 4** — Remote GPU health check and logs reviewed; user approved
- [ ] Lint checks pass (`tsc --noEmit`, `py_compile`)
- [ ] Commit messages follow `type: description` format
- [ ] Branch name follows `type/brief-description` convention
- [ ] PR title is clear and descriptive
- [ ] Documentation updated ([CHANGELOG.md](CHANGELOG.md), [README.md](README.md), [.claude/PROJECT_STRUCTURE.md](.claude/PROJECT_STRUCTURE.md) as needed)
- [ ] No secrets, credentials, or sensitive data in committed code
- [ ] Code follows project conventions and existing patterns
- [ ] No unnecessary files added (temp files, IDE configs, build artifacts)
