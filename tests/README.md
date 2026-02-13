# Automated UI Testing with Playwright

This directory contains automated UI tests for the Pose Spatial Studio application using Playwright.

## Setup

1. **Install Playwright dependencies** (if not already installed):
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Verify Playwright MCP is configured**:
   Check that `~/.claude/mcp_settings.json` includes:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["-y", "@playwright/mcp"]
       }
     }
   }
   ```

## Running Tests

### Manual Test Execution

Run all tests:
```bash
npx playwright test
```

Run tests in headed mode (visible browser):
```bash
npx playwright test --headed
```

Run a specific test file:
```bash
npx playwright test tests/pose-validation.spec.ts
```

Run tests in debug mode:
```bash
npx playwright test --debug
```

### Using Claude Code with Playwright MCP

When using Claude Code, you can run tests via the Playwright MCP integration:

1. Load Playwright tools:
   ```
   Use ToolSearch with query: "playwright"
   ```

2. Ask Claude to run tests:
   ```
   Run the pose validation tests using Playwright
   ```

## Test Results

- **HTML Report**: After running tests, view the report with:
  ```bash
  npx playwright show-report
  ```

- **Screenshots**: Failed test screenshots are saved in `test-results/`

- **Videos**: Test execution videos (on failure) are saved in `test-results/`

## Writing New Tests

When adding new tests:

1. Create a new `.spec.ts` file in the `tests/` directory
2. Follow the pattern in `pose-validation.spec.ts`
3. Update selectors to match your actual UI components
4. Add data-testid attributes to components for reliable selection

Example:
```tsx
// In your React component
<input data-testid="camera-name" />

// In your test
await page.locator('[data-testid="camera-name"]').fill('test');
```

## Customization

### Update Selectors

The test file uses generic selectors. Update them to match your actual implementation:

- Camera name input: Update `input[name="cameraName"]` selector
- Camera selection: Update `select[name="camera"]` selector
- Avatar renderer: Update `canvas` or add `data-testid="avatar-renderer"`

### Add Acceptance Criteria Tests

In the "Acceptance Criteria Validation" test suite, add specific tests for your Step 1 acceptance criteria.

## Continuous Integration

To run tests in CI/CD:

```bash
CI=true npx playwright test
```

This will:
- Run tests in headless mode
- Disable test retries
- Use a single worker (no parallelization)

## Troubleshooting

### Tests timing out?
- Increase timeout in `playwright.config.ts`
- Ensure backend/frontend servers are running

### Selectors not found?
- Inspect your UI components
- Add `data-testid` attributes
- Update selectors in test files

### Server not starting?
- Check that `./run_server.sh` and `./run_ui.sh` scripts exist
- Verify ports 8000 and 8585 are available
