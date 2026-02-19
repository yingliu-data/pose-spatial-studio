---
name: code-review
---

Review code changes **$ARGUMENTS** following the structured code review workflow below.

## TODO List

After identifying the scope of review (Step 1), **create a TODO list** using the `TodoWrite` tool with:
- One task for each review phase (lint, quality, performance, testing)
- One task for each file or component under review

Mark each task as `in_progress` when starting work on it, and `completed` immediately when finished. This ensures thorough, systematic coverage of all review criteria.

## Workflow Steps

1. **Scope** -- Identify changes to review and establish review context
2. **Lint** -- Run linters and static analysis tools
3. **Code quality** -- Assess readability, structure, and conventions
4. **Performance** -- Analyze memory usage, speed, and algorithmic complexity
5. **Security** -- Check for vulnerabilities and sensitive data exposure
6. **Integration test** -- Validate changes work end-to-end in both directions
7. **Summary** -- Report findings and recommend actions

---

## Step 1: Identify Review Scope

Determine what code is under review:

1. **Diff the changes** against the base branch:
   ```bash

   git diff main...HEAD --stat
   git diff main...HEAD
   ```
2. **List affected files** and categorize them (frontend, backend, config, docs)
3. **Read each changed file** in full to understand context around the diff
4. **Note the intent**: What is the change trying to accomplish?

Document the following before proceeding:
- Files changed and lines affected
- Summary of what the changes do
- Which acceptance criteria (if any) apply

---

## Step 2: Lint Check

Run linters and static analysis for each affected area:

### Frontend (TypeScript / React)
```bash
cd frontend
npx eslint src/ --ext .ts,.tsx
npx tsc --noEmit
```

### Backend (Python)
```bash
cd backend
python -m py_compile app.py
# Run any configured linters (flake8, ruff, mypy, etc.)
```

### Review for:
- Syntax errors or warnings
- Unused imports and variables
- Type errors or mismatches
- Formatting inconsistencies

**If lint issues are found**: list each issue with file path and line number.

---

## Step 3: Code Quality Review

Assess the code for cleanliness and maintainability:

### Readability
- Are variable and function names descriptive and consistent with existing conventions?
- Is the control flow easy to follow?
- Are complex sections commented where necessary (but not over-commented)?

### Structure
- Does the code follow existing project patterns and architecture?
- Are responsibilities properly separated (e.g., no business logic in UI components)?
- Are new files placed in the correct directories per `PROJECT_STRUCTURE.md`?

### Conventions
- Does the code match the style of surrounding code?
- Are TypeScript types properly defined (no unnecessary `any`)?
- Are Python type hints used consistently with the rest of the codebase?

### Duplication
- Is there duplicated logic that should be extracted?
- Are there existing utilities or helpers that could be reused?

---

## Step 4: Performance Review

Analyze memory usage, speed, and algorithmic complexity:

### Algorithmic complexity
- What is the Big O time and space complexity of new or modified logic?
- Are there unnecessary nested loops, redundant computations, or O(n^2) patterns that could be O(n)?

### Memory
- Are large objects or arrays properly cleaned up?
- Are event listeners, intervals, or subscriptions properly disposed of?
- Are WebSocket connections and streams managed without leaks?

### Rendering (Frontend)
- Are React components avoiding unnecessary re-renders?
- Are expensive computations memoized where appropriate?
- Are Three.js objects (geometries, materials, textures) properly disposed?

### I/O (Backend)
- Are database queries or API calls efficient?
- Is caching used appropriately?
- Are WebSocket frame sizes and frequencies reasonable?

---

## Step 5: Security Review

Check for common vulnerabilities:

- **No secrets in code**: No API keys, passwords, tokens, or credentials in committed files
- **Input validation**: User inputs are sanitized at system boundaries
- **Dependency safety**: No known vulnerable packages introduced
- **CORS / auth**: WebSocket and API endpoints have appropriate access controls
- **Data exposure**: No sensitive data logged or sent to the client unnecessarily

---

## Step 6: Integration Testing

Validate that changes work correctly end-to-end using two test configurations:

### 6.1: Local frontend + Remote backend

Test the frontend changes against the production backend:
1. Start the frontend locally:
   ```bash
   cd frontend
   ./run_ui.sh
   ```
2. Configure the frontend to connect to the remote backend (`https://robot.yingliu.site`)
3. Open `http://localhost:8585` in the browser
4. Validate:
   - Does the UI render correctly?
   - Does pose detection and avatar movement work?
   - Are there console errors or broken WebSocket connections?

**If issues are found**: return to development using the develop skill (`/develop`), then re-run this review.

### 6.2: Remote frontend + Local backend

Test the backend changes against the production frontend:
1. Start the backend locally:
   ```bash
   cd backend
   ./run_server.sh
   ```
2. Access the remote frontend at `https://robot.yingliu.site`
3. Configure it to connect to the local backend
4. Validate:
   - Does the backend serve pose data correctly?
   - Are WebSocket streams stable?
   - Is the response time acceptable?

**If issues are found**: return to development using the develop skill (`/develop`), then re-run this review.

### Automated testing (optional)

Use Playwright for automated validation. See `tests/README.md` for full setup.

```bash
cd tests
npm test                    # run all tests
npm run test:headed         # run with visible browser
```

Or use Playwright MCP tools in Claude Code:
1. Load Playwright tools via `ToolSearch` with query: `"playwright"`
2. Navigate to `http://localhost:8585`
3. Fill camera name as `test`, select laptop camera
4. Verify pose detection renders and avatar responds
5. Capture screenshots for visual confirmation

Test specs are in `tests/specs/`. See `tests/specs/pose-validation.spec.ts` for the existing test suite.

---

## Step 7: Review Summary

Compile findings into a structured report:

### Report format

```markdown
## Code Review Summary

**Branch**: <branch-name>
**Files reviewed**: <count>
**Overall assessment**: PASS | PASS WITH COMMENTS | NEEDS CHANGES

### Lint
- [ ] All lint checks pass

### Code Quality
- [ ] Naming and conventions consistent
- [ ] Structure follows project patterns
- [ ] No unnecessary duplication

### Performance
- [ ] No algorithmic concerns
- [ ] Memory management is correct
- [ ] No rendering or I/O bottlenecks

### Security
- [ ] No secrets or credentials exposed
- [ ] Input validation present at boundaries

### Integration
- [ ] Local frontend + remote backend: PASS / FAIL
- [ ] Remote frontend + local backend: PASS / FAIL

### Issues Found
| # | Severity | File | Line | Description |
|---|----------|------|------|-------------|
| 1 | High/Medium/Low | path/to/file | 42 | Description of issue |

### Recommendations
- <action items for the developer>
```

### Severity levels
| Level | Meaning | Action |
|-------|---------|--------|
| **High** | Bug, security issue, or data loss risk | Must fix before merge |
| **Medium** | Performance concern or convention violation | Should fix before merge |
| **Low** | Style nit or minor improvement | Optional, can fix later |

---

## After Review

Present the review summary to the user and use `AskUserQuestion` to determine next steps:

**Question:** "How would you like to proceed after the review?"

**Options:**
- Fix issues and re-review (Recommended) -- Address findings and run the review again
- Proceed to commit -- Accept current state and commit changes
- Discuss findings -- Talk through specific issues before deciding
