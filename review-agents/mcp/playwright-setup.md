# Playwright MCP Setup Guide

## Overview
Playwright Model Context Protocol (MCP) server enables Claude Code to control browsers, interact with web pages, capture screenshots, and perform automated testing through natural language commands.

## Installation Methods

### Method 1: Claude Code CLI (Recommended)
```bash
# Add Playwright MCP to current project
claude mcp add playwright

# Or use VS Code command
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

### Method 2: Manual Configuration
Add to `.claude.json` in your project root:
```json
{
  "mcps": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Method 3: Global Installation
```bash
# Install globally
npm install -g @playwright/mcp

# Configure in .claude.json
{
  "mcps": {
    "playwright": {
      "command": "playwright-mcp"
    }
  }
}
```

## Available Playwright MCP Servers

### 1. Microsoft's Official Server
**Package**: `@playwright/mcp`
- Accessibility-focused testing
- Structured page snapshots
- No screenshot dependency
- Optimized for testing workflows

### 2. ExecuteAutomation Server
**Package**: `@executeautomation/playwright-mcp-server`
- Visual browser control
- Natural language commands
- Session persistence
- API testing support

## Configuration Options

### Basic Configuration
```json
{
  "mcps": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {
        "HEADLESS": "false",
        "TIMEOUT": "30000"
      }
    }
  }
}
```

### Advanced Configuration
```json
{
  "mcps": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "config": {
        "browser": "chromium",
        "headless": false,
        "viewport": {
          "width": 1280,
          "height": 720
        },
        "timeout": 30000,
        "screenshot": {
          "type": "png",
          "fullPage": true
        },
        "session": {
          "persist": true,
          "cookieFile": ".playwright-cookies.json"
        }
      }
    }
  }
}
```

## Basic Usage

### Browser Control Commands
```bash
# Open a browser
Use playwright mcp to open a browser to example.com

# Navigate to URL
Navigate to https://app.example.com/login

# Take screenshot
Take a screenshot of the current page

# Click elements
Click on the button with text "Submit"

# Fill forms
Fill the input with id "email" with "user@example.com"

# Wait for elements
Wait for the element with class "loading" to disappear
```

### Testing Commands
```bash
# Generate tests
Generate Playwright tests for the login flow

# Run tests
Execute the Playwright test suite

# Visual regression
Compare current page against baseline screenshot

# Accessibility audit
Run accessibility tests on the current page
```

## Integration with Agents

### Design Review Agent Integration
```javascript
// In design-review agent
const playwright = {
  launch: () => "Launch browser for visual testing",
  screenshot: () => "Capture page state",
  responsive: (viewport) => `Test at ${viewport}px width`,
  accessibility: () => "Run accessibility audit"
};
```

### Code Review Agent Integration
```javascript
// In code-review agent
const playwright = {
  testGeneration: () => "Generate tests for new code",
  coverage: () => "Measure test coverage",
  integration: () => "Verify UI integration"
};
```

## Session Management

### Persistent Sessions
```bash
# Login once, reuse session
Claude: "Navigate to app and login"
User: [Manually logs in]
Claude: "Session saved. Continue with authenticated actions"
```

### Session Configuration
```json
{
  "playwright": {
    "session": {
      "persist": true,
      "storageState": ".auth/session.json",
      "maxAge": 3600000
    }
  }
}
```

## Testing Workflows

### Test Generation
```yaml
# Natural language test definition
test: User Registration Flow
steps:
  - Navigate to /register
  - Fill form with valid data
  - Submit registration
  - Verify success message
  - Check email verification
```

### Visual Regression Testing
```javascript
// Baseline capture
await playwright.screenshot({ path: 'baseline.png' });

// Comparison
const diff = await playwright.compare('baseline.png', 'current.png');
```

### API Testing
```javascript
// HTTP request testing
const response = await playwright.apiRequest({
  method: 'POST',
  url: '/api/users',
  data: { name: 'Test User' }
});
```

## Performance Optimization

### Caching Strategies
```json
{
  "playwright": {
    "cache": {
      "screenshots": true,
      "sessions": true,
      "maxAge": 86400000
    }
  }
}
```

### Parallel Execution
```javascript
// Run multiple viewports in parallel
const viewports = [375, 768, 1024, 1440];
await Promise.all(
  viewports.map(width => testAtViewport(width))
);
```

## Troubleshooting

### Common Issues

#### Browser Won't Launch
```bash
# Install browser dependencies
npx playwright install-deps

# Specify browser path
export PLAYWRIGHT_BROWSERS_PATH=/usr/local/browsers
```

#### Session Not Persisting
```bash
# Check cookie storage
ls -la .playwright-cookies.json

# Clear corrupted session
rm .playwright-cookies.json
```

#### Timeout Issues
```javascript
// Increase timeout
playwright.setDefaultTimeout(60000);

// Custom timeout for specific action
await page.click('button', { timeout: 10000 });
```

## Best Practices

### 1. Explicit Waits
```javascript
// Good: Wait for specific condition
await page.waitForSelector('.content-loaded');

// Bad: Arbitrary sleep
await page.waitForTimeout(3000);
```

### 2. Selector Strategy
```javascript
// Priority order:
1. data-testid="submit-button"  // Best
2. role="button"                 // Good
3. #submit-button               // OK
4. .btn.btn-primary            // Fragile
5. xpath="//button[1]"         // Avoid
```

### 3. Error Handling
```javascript
try {
  await page.click('button');
} catch (error) {
  // Take screenshot for debugging
  await page.screenshot({ path: 'error.png' });
  throw error;
}
```

### 4. Resource Cleanup
```javascript
// Always close browser
try {
  // Test code
} finally {
  await browser.close();
}
```

## Environment Variables

```bash
# Browser selection
PLAYWRIGHT_BROWSER=chromium|firefox|webkit

# Headless mode
PLAYWRIGHT_HEADLESS=true|false

# Slow motion (debugging)
PLAYWRIGHT_SLOW_MO=100

# Download directory
PLAYWRIGHT_DOWNLOAD_PATH=/tmp/downloads

# Proxy settings
PLAYWRIGHT_PROXY_SERVER=http://proxy:8080
```

## Advanced Features

### Network Interception
```javascript
// Mock API responses
await page.route('**/api/data', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ test: true })
  });
});
```

### Console Monitoring
```javascript
// Capture console messages
page.on('console', msg => {
  console.log(`Browser console: ${msg.text()}`);
});
```

### Download Handling
```javascript
// Wait for download
const download = await page.waitForEvent('download');
await download.saveAs('/path/to/file');
```

## Security Considerations

### Credential Management
```javascript
// Never hardcode credentials
const username = process.env.TEST_USER;
const password = process.env.TEST_PASS;
```

### Sandbox Configuration
```json
{
  "playwright": {
    "launchOptions": {
      "args": ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  }
}
```

## Performance Metrics

### Core Web Vitals
```javascript
// Measure performance
const metrics = await page.evaluate(() => ({
  lcp: performance.measure('LCP'),
  fid: performance.measure('FID'),
  cls: performance.measure('CLS')
}));
```

### Custom Metrics
```javascript
// Track custom timing
await page.evaluate(() => {
  performance.mark('custom-start');
  // ... operations ...
  performance.mark('custom-end');
  performance.measure('custom', 'custom-start', 'custom-end');
});
```

## Integration Examples

### With GitHub Actions
```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npx playwright install
      - run: npm test
```

### With Docker
```dockerfile
FROM mcr.microsoft.com/playwright:focal
WORKDIR /app
COPY . .
RUN npm ci
CMD ["npm", "test"]
```

## Resources

- [Official Playwright Docs](https://playwright.dev)
- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [Claude Code MCP Guide](https://docs.anthropic.com/claude-code/mcp)
- [Community Examples](https://github.com/topics/playwright-mcp)