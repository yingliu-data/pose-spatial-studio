# Playwright MCP Setup Complete ✓

Automated UI testing has been configured for your Pose Spatial Studio project.

## What Was Installed

### 1. Playwright MCP Server
- **Location**: Globally installed via npm
- **Purpose**: Enables Claude Code to control browsers for automated testing
- **Configuration**: `~/.claude/mcp_settings.json`

### 2. Test Infrastructure
- **Config**: [playwright.config.ts](./playwright.config.ts)
- **Tests**: [tests/pose-validation.spec.ts](./tests/pose-validation.spec.ts)
- **Dependencies**: [package.json](./package.json)

### 3. Updated Workflow
- **SKILL.md** now includes automated testing instructions in Step 6

## Quick Start

### Option 1: Using Claude Code with Playwright MCP

**After restarting Claude Code**, you can use Playwright tools:

```
1. Load Playwright tools:
   Use ToolSearch with query: "playwright"

2. Ask Claude to run tests:
   "Run the pose validation tests"
   "Test the pose capture workflow"
   "Generate a test report"
```

### Option 2: Manual Command Line

Run tests manually:

```bash
# Run all tests
npm test

# Run with visible browser
npm run test:headed

# Run in debug mode
npm run test:debug

# View test report
npm run test:report
```

## Test Coverage

The initial test suite includes:

1. ✓ Application loads successfully
2. ✓ Camera name input validation
3. ✓ Camera selection (laptop option)
4. ✓ Full pose capture workflow
5. ✓ Avatar renderer visibility
6. ✓ Pose movement detection
7. ✓ Acceptance criteria validation

## Next Steps

### 1. Restart Claude Code
**Important**: You must restart Claude Code for the Playwright MCP to be loaded.

```bash
# If using VSCode extension, reload the window
# If using CLI, restart your terminal session
```

### 2. Customize Test Selectors

Update the test file to match your actual UI components:

**File**: [tests/pose-validation.spec.ts](./tests/pose-validation.spec.ts)

```tsx
// Add data-testid attributes to your components
// Example in your React components:

// AvatarRenderer.tsx
<canvas data-testid="avatar-renderer" />

// Camera input
<input data-testid="camera-name" name="cameraName" />

// Camera selection
<select data-testid="camera-source">
  <option value="laptop">Laptop Camera</option>
</select>
```

### 3. Add Acceptance Criteria Tests

In the test file, customize the acceptance criteria validation section based on your Step 1 requirements.

### 4. Run Your First Test

```bash
# Start your servers (backend + frontend)
cd backend && ./run_server.sh &
cd frontend && ./run_ui.sh &

# Run the tests
npm test
```

## Integration with SKILL.md

The development workflow (`.claude/skills/develop/SKILL.md`) has been updated:

**Step 6: Validate** now includes:
- **Option A**: Automated Testing with Playwright (Recommended)
- **Option B**: Manual Testing

When using the `/develop` skill, Claude will automatically suggest using Playwright for testing.

## Troubleshooting

### MCP not working?
1. Check `~/.claude/mcp_settings.json` exists
2. Restart Claude Code
3. Run `ToolSearch` with query "playwright" to verify tools are loaded

### Tests failing?
1. Ensure backend is running on port 8000
2. Ensure frontend is running on port 8585
3. Update selectors in test file to match your UI

### Need help?
- Check [tests/README.md](./tests/README.md) for detailed documentation
- Run `npx playwright test --help` for CLI options
- Visit https://playwright.dev/docs/intro for Playwright docs

## Files Created

```
pose-spatial-studio/
├── playwright.config.ts          # Playwright configuration
├── package.json                   # Test dependencies and scripts
├── PLAYWRIGHT_SETUP.md           # This file
└── tests/
    ├── README.md                  # Detailed testing guide
    └── pose-validation.spec.ts   # Main test suite
```

## Configuration File

**MCP Settings** (`~/.claude/mcp_settings.json`):
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

---

**Ready to test!** 🎭

Start by restarting Claude Code, then try:
```
"Run the pose validation tests with Playwright"
```
