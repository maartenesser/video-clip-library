# Claude Code Templates

> Plug-and-play Claude Code configuration templates for automated design and code review agents with Playwright MCP integration

## 🚀 Quick Start

### 1. Copy Templates to Your Project
```bash
# Clone this repository
git clone https://github.com/maartenesser/claude-code-templates.git

# Copy templates to your project
cp -r claude-code-templates/* /path/to/your/project/

# Or copy specific files
cp claude-code-templates/CLAUDE.md /path/to/your/project/
cp -r claude-code-templates/agents /path/to/your/project/
```

### 2. Install Dependencies (Optional)
```bash
# If you want to use Playwright MCP
npm install

# Install Playwright browsers
npx playwright install
```

### 3. Configure Claude Code
```bash
# Add Playwright MCP to Claude Code
claude mcp add playwright

# Or manually configure in VS Code
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/mcp@latest"]}'
```

### 4. Start Using Agents
```bash
# In Claude Code, invoke agents with @
@design-review Check the login page accessibility
@code-review Review the authentication module
```

## 📁 Repository Structure

```
claude-code-templates/
├── CLAUDE.md                    # Main project context for Claude
├── workflow.md                  # Workflow definitions
├── agents/                      # Agent configurations
│   ├── design-review.md        # UI/UX review agent
│   └── code-review.md          # Code quality agent
├── mcp/                        # MCP server documentation
│   └── playwright-setup.md     # Playwright MCP guide
├── examples/                   # Usage examples
│   ├── design-review-example.md
│   └── code-review-example.md
├── .claude.json               # Claude Code configuration
├── package.json              # Node dependencies (optional)
└── README.md                 # This file
```

## 🤖 Available Agents

### Design Review Agent
**Purpose**: Automated UI/UX review with visual testing

**Capabilities**:
- Responsive design validation (mobile, tablet, desktop)
- Accessibility compliance (WCAG 2.1 AA)
- Visual consistency checking
- Performance impact analysis
- Screenshot-based comparisons

**Usage**:
```bash
@design-review Review the dashboard for mobile responsiveness
@design-review Check accessibility of the checkout flow
@design-review Validate dark mode implementation
```

### Code Review Agent
**Purpose**: Comprehensive code quality and security analysis

**Capabilities**:
- Security vulnerability detection
- Performance optimization suggestions
- Architecture pattern validation
- Test coverage analysis
- Best practices enforcement

**Usage**:
```bash
@code-review Review the payment processing module
@code-review Security audit for user authentication
@code-review Check performance of data processing
```

## 🔧 Configuration

### Basic Setup
The templates work out of the box, but you can customize them:

1. **Edit `.claude.json`** to modify MCP settings and agent configurations
2. **Update `CLAUDE.md`** to add project-specific context
3. **Modify `workflow.md`** to create custom workflows
4. **Customize agents** in the `agents/` directory

### Playwright MCP Configuration
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
        }
      }
    }
  }
}
```

### Custom Agent Configuration
Agents can be customized by editing their markdown files:
```markdown
# agents/custom-agent.md
## Name
custom-agent

## Description
Your custom agent description

## Workflow Instructions
Your agent's specific workflow...
```

## 🎯 Workflows

### Design Review Workflow
1. Initial visual analysis
2. Responsive design testing
3. Accessibility audit
4. Performance check
5. Report generation

### Code Review Workflow
1. Static analysis
2. Security scanning
3. Architecture review
4. Performance analysis
5. Test coverage check
6. Documentation validation

### Integration Workflow
Combines both design and code review for complete feature validation.

## 🔍 Examples

### Example: Review a New Feature
```bash
# 1. Start with design review
@design-review Review the new user profile page

# 2. Follow with code review
@code-review Review the profile controller implementation

# 3. Run integrated review
@integration-review Complete review of user profile feature
```

### Example: Accessibility Audit
```bash
# Comprehensive accessibility check
@design-review Perform WCAG AA compliance audit on all forms

# Results include:
# - Color contrast validation
# - Keyboard navigation testing
# - Screen reader compatibility
# - ARIA implementation review
```

### Example: Security Audit
```bash
# Security-focused code review
@code-review Security audit for the API endpoints

# Checks for:
# - SQL injection vulnerabilities
# - XSS risks
# - Authentication issues
# - Input validation
```

## 🛠️ Customization

### Adding Project-Specific Rules

1. **Design System Rules** - Edit `.claude.json`:
```json
{
  "projectRules": {
    "design": {
      "colors": {
        "primary": "#007AFF",
        "secondary": "#5856D6"
      },
      "spacing": {
        "unit": 8
      }
    }
  }
}
```

2. **Code Standards** - Add to `.claude.json`:
```json
{
  "projectRules": {
    "code": {
      "maxComplexity": 10,
      "requireTests": true,
      "minCoverage": 80
    }
  }
}
```

### Creating Custom Workflows

Add new workflows to `workflow.md`:
```markdown
## Custom Workflow Name

### Purpose
Description of your workflow

### Steps
1. Step one
2. Step two
3. Step three

### Example Usage
@custom-workflow [parameters]
```

## 🔌 Integrations

### GitHub Integration
```yaml
# .github/workflows/claude-review.yml
name: Claude Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Claude Review
        run: |
          # Your Claude review commands
```

### VS Code Integration
The templates automatically integrate with Claude Code when placed in your project directory. Claude will read the configuration files and make agents available.

### CI/CD Pipeline
```bash
# In your CI/CD pipeline
npm test
claude review  # If CLI is available
```

## 📝 Best Practices

1. **Keep CLAUDE.md Updated**: Add project-specific context as your project evolves
2. **Customize Agents**: Tailor agents to your team's standards
3. **Use Workflows**: Leverage predefined workflows for consistency
4. **Regular Reviews**: Run agents on all PRs and major changes
5. **Iterate on Feedback**: Adjust agent configurations based on team feedback

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### How to Contribute
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude Code
- [Microsoft](https://github.com/microsoft/playwright) for Playwright
- [Model Context Protocol](https://modelcontextprotocol.io) community

## 📚 Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Playwright Documentation](https://playwright.dev)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 💬 Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/maartenesser/claude-code-templates/issues)
- Check the [examples](./examples) directory for usage patterns
- Review the [documentation](./mcp/playwright-setup.md) for setup help

---

Made with ❤️ for the Claude Code community