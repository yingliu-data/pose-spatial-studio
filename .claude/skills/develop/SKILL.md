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

1. **Understand** -- Fetch the input, understand requirements and acceptance criteria
2. **Branch** -- Create a properly named branch from the correct base
3. **Implement** -- Make changes following code conventions
4. **Validate** -- Run analysis and tests
5. **Changelog** -- Add entry to CHANGELOG.md
6. **Review** -- Optionally run a developer review to catch issues early
7. **Commit** -- Use conventional commit messages
8. **Push & MR** -- Create a merge request with proper title format

---

## Step 1: Understand the Requirement

Thoroughly analyze the requirement by:
1. Breaking down the request into discrete components
2. Identifying acceptance criteria, dependencies, and any linked PRDs or designs
3. Using `AskUserQuestion` to clarify any ambiguities

Document the following:
- Summary of the requirement
- Detailed description
- Acceptance criteria (what defines "done")
- Dependencies on other work
- Links to PRDs or design documents

---

## Step 2: Navigate to Correct Folder

1. Read `PROJECT_STRUCTURE.md` to understand the project architecture
2. Identify which folder(s) will be affected by the changes
3. Navigate to the appropriate directory using `cd` command

---

## Step 3: Fetch and Checkout Base Branch

```bash
git fetch origin
```


Determine the base branch to use:
- If one release branch exists, use it
- If multiple exist, show the latest two and ask the user which to target using `AskUserQuestion` (mark the latest as "Recommended")

**For new features**, create a new branch from the main/develop branch:
```bash
git checkout main
git checkout -b new-branch-name
```

---

## Step 4: Create Feature Branch

**Branch naming format:** `type/brief-description`

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

---

## Step 5: Implement Changes and lint check

Follow these guidelines during implementation:
1. **Code conventions**: Maintain consistent formatting and style with existing codebase
2. **Acceptance criteria**: Ensure all acceptance criteria from Step 1 are fully met
3. **Update TODO**: Mark tasks as `in_progress` when starting, `completed` when finished
4. **Testing as you go**: Validate changes incrementally to catch issues early
5. **Optimize algorithm complexity**: Analyze and improve Big O time/space complexity where possible
6. **Lint check**: Run linters and code quality tools to ensure code meets project standards

---

## Step 6: Validate

### Start the development environment:

1. **Start the backend server:**
   ```bash
   cd backend
   ./run_server.sh
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   ./run_ui.sh
   ```

3. **Verify configuration:** Ensure the frontend is connecting to the local backend (not the production remote server)

### Test the implementation:

You can test either **manually** or using **automated Playwright testing**.

#### Option A: Automated Testing with Playwright (Recommended)

Use Playwright MCP to automate UI testing:

1. **Use ToolSearch to load Playwright tools:**
   ```
   Use ToolSearch with query: "playwright"
   ```

2. **Run automated test:**
   - Navigate to `http://localhost:8585`
   - Fill in camera name as 'test'
   - Select laptop camera option
   - Capture screenshots and validate pose detection
   - Verify avatar movement matches expected behavior
   - Generate test report

3. **Example Playwright test script** (tests/pose_validation.spec.ts):
   ```typescript
   import { test, expect } from '@playwright/test';

   test('pose capture and avatar validation', async ({ page }) => {
     // Navigate to app
     await page.goto('http://localhost:8585');

     // Fill camera name
     await page.fill('[data-testid="camera-name"]', 'test');

     // Select laptop camera
     await page.selectOption('[data-testid="camera-source"]', 'laptop');

     // Wait for pose detection
     await page.waitForSelector('[data-testid="avatar-movement"]', { timeout: 10000 });

     // Validate avatar is rendering
     const avatarVisible = await page.isVisible('[data-testid="avatar-renderer"]');
     expect(avatarVisible).toBeTruthy();

     // Take screenshot for visual verification
     await page.screenshot({ path: 'test-results/pose-validation.png' });
   });
   ```

#### Option B: Manual Testing

1. Open browser to `http://localhost:8585`
2. In the UI:
   - Enter camera name as 'test'
   - Select laptop camera option
   - Capture human pose and observe avatar movement
3. **Validate visually:**
   - Does pose detection work correctly?
   - Does avatar movement match pose?
   - Are there any visual glitches or errors?

---

### Validate against acceptance criteria:
- Does the performance match all criteria from Step 1?
- If NO: Return to Step 5 and continue development
- If YES: Proceed to Step 7 

---

## Step 7: Update Documentation

Update the following documentation files as needed:

### 1. Update CHANGELOG.md
Add an entry to the appropriate `CHANGELOG.md` file:

**Format:**
```markdown
## <version> - <Month Year>

- <brief feature summary (under 10 words)>: <Title>
```

If the version section doesn't exist, create it at the top of the file.

### 2. Update PROJECT_STRUCTURE.md
If the changes affect project architecture, update `PROJECT_STRUCTURE.md` accordingly.

### 3. Update README.md
If the changes affect setup, usage, or dependencies, update the relevant `README.md` file.

### 4. Update TODO status
Mark all completed tasks in your TODO list as `completed` using `TodoWrite`. 

---

## Step 8: Developer Review (Optional)

Use `AskUserQuestion` to ask whether the user wants to run a Developer Review before committing:

**Question:** "Would you like to run a Developer Review before committing?"

**Options:**
- Yes (Recommended) - Review changes against base branch to catch issues early
- No - Skip review and proceed to commit

If the user selects "Yes", follow the process defined in `skills/code-review/SKILL.md`.

---

## Step 9: Commit Changes

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
5. **Co-author**: Include co-authorship line:
   ```
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
   ```

---

## Step 10: Push Branch

```bash
git push -u origin <branch-name>
```

---

## Step 11: Create Merge Request (Pull Request)

### PR Title format
Use a clear, descriptive title that summarizes the changes.

**Example:** `Add avatar joint rotation and axis alignment support`

### Create the PR
Use `gh pr create` CLI command or GitHub MCP tools.

### PR Description should include:
1. **Summary of changes**: Brief overview of what was implemented
2. **Link to issue/ticket**: Reference the original requirement or issue number
3. **Testing notes**: How to test the changes, steps to reproduce
4. **Screenshots**: Include screenshots for UI changes
5. **Acceptance criteria**: Confirm all criteria from Step 1 are met

---

## Branching from In-Progress Work

When a ticket depends on another ticket still in code review, branch from the in-review ticket's branch:

```bash
git checkout -b feat/mga-5678-dependent-feature origin/feat/mga-1234-base-feature
```

After the base ticket is merged, rebase onto the target branch and force push with `--force-with-lease`.

---

## Pre-PR Checklist

Before creating the pull request, verify all of the following:

- [ ] All acceptance criteria from Step 1 are fully met
- [ ] All TODO tasks are marked as `completed`
- [ ] Tests written and passing (where applicable)
- [ ] Manual validation completed successfully (Step 6)
- [ ] Commit messages follow `type: description` format
- [ ] Branch name follows `type/brief-description` convention
- [ ] PR title is clear and descriptive
- [ ] Documentation updated (CHANGELOG.md, README.md, PROJECT_STRUCTURE.md as needed)
- [ ] No secrets, credentials, or sensitive data in committed code
- [ ] Code follows project conventions and existing patterns
- [ ] Lint checks pass with no issues
- [ ] Memory optimization verified (if applicable)
- [ ] No unnecessary files added (temp files, IDE configs, build artifacts, etc.)