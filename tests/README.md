# E2E Tests (Playwright)

Automated UI tests for the Pose Spatial Studio application.

## Structure

```
tests/
├── playwright.config.ts     # Playwright configuration
├── package.json             # Test dependencies
├── README.md                # This file
├── specs/                   # Test specifications
│   └── pose-validation.spec.ts
└── results/                 # Test output (gitignored)
```

## Setup

```bash
cd tests
npm install
npx playwright install
```

### Playwright MCP (for Claude Code)

Ensure `~/.claude/mcp_settings.json` includes:
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

```bash
cd tests

# Run all tests
npm test

# Run with visible browser
npm run test:headed

# Run in debug mode
npm run test:debug

# Interactive UI mode
npm run test:ui

# View HTML report
npm run test:report
```

## Servers

Playwright auto-starts both servers via `webServer` config:
- **Backend**: `../backend/run_server.sh` on port 49101
- **Frontend**: `../frontend/run_ui.sh` on port 8585

Set `reuseExistingServer` to skip auto-start when servers are already running (default in dev).

## Writing Tests

1. Create `.spec.ts` files in `specs/`
2. Add `data-testid` attributes to React components for reliable selectors
3. Follow the pattern in `pose-validation.spec.ts`

```tsx
// Component
<input data-testid="camera-name" />

// Test
await page.locator('[data-testid="camera-name"]').fill('test');
```
