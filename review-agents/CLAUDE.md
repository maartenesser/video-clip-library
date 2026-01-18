# Claude Code Templates - Project Context

## Overview
This repository provides a plug-and-play Claude Code configuration template for integrating sophisticated design and code review agents into any development project, optimized for modern tech stacks including Next.js 15, Tailwind CSS, and shadcn/ui. No application code is included - only configurations, workflows, and documentation.

## Purpose
Enable teams to quickly adopt AI-powered review processes by copying these configuration files into their existing repositories. The templates are designed to work immediately with Claude Code while being fully customizable for specific project needs.

## Available Agents

### 1. Design Review Agent (`agents/design-review.md`)
- **Purpose**: Automated UI/UX review and visual testing
- **Capabilities**:
  - Responsive design validation
  - Accessibility compliance checking
  - Visual consistency analysis
  - Screenshot-based design comparisons
  - Component pattern validation
- **Integration**: Playwright MCP for browser automation

### 2. Code Review Agent (`agents/code-review.md`)
- **Purpose**: Comprehensive code quality and security analysis
- **Capabilities**:
  - Security vulnerability detection
  - Performance bottleneck identification
  - Architecture pattern compliance
  - Test coverage analysis
  - Documentation completeness
- **Integration**: GitHub PR automation

## Workflows

Predefined workflows in `workflow.md`:
- **Design Review Workflow**: Step-by-step UI/UX validation process
- **Code Review Workflow**: Automated PR review pipeline
- **Testing Workflow**: Playwright-based test generation and execution
- **Integration Workflow**: Combined design and code review process

## MCP Integration

### Playwright MCP
- Browser automation for visual testing
- Test generation from user interactions
- Session persistence for efficient testing
- Natural language test creation

Configuration location: `.claude.json`

## Quick Start Commands

### Initialize agents in your project:
```bash
# Copy all template files to your project
cp -r . /path/to/your/project/

# Configure Playwright MCP
claude mcp add playwright
```

### Invoke agents:
```
# For design review
@design-review Check the responsive design of the login page

# For code review
@code-review Review the authentication module for security issues
```

## Technology Stack Support

### Optimized for Modern Development
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with custom configuration
- **Components**: shadcn/ui + Radix UI primitives
- **Animations**: Framer Motion + Tailwind animations
- **Typography**: Inter font via next/font/google
- **Testing**: Jest, React Testing Library, Playwright
- **Performance**: Next/Image, dynamic imports, Suspense

## Project Standards

### When using these agents:
1. **Always test first**: Generate tests before implementation
2. **Visual validation**: Use Playwright for UI verification
3. **Security first**: Run security checks on all code changes
4. **Accessibility**: Ensure WCAG 2.1 AA+ compliance (4.5:1 contrast)
5. **Performance**: Monitor Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)
6. **Type safety**: Enforce TypeScript strict mode
7. **Style consistency**: Follow Tailwind class organization patterns
8. **Component patterns**: Use shadcn/ui composition patterns
9. **Excellence standards**: Apply S-tier SaaS design checklist criteria
10. **Live environment first**: Test in real browser before static analysis

### Review Criteria
- Code must pass both design and code review agents
- All UI changes require screenshot validation
- Security vulnerabilities must be addressed immediately
- Performance regressions block deployment
- TypeScript compilation must succeed without errors
- Tailwind classes must be properly organized
- Components must follow shadcn/ui patterns
- Images must use Next/Image optimization
- Metadata must be configured for SEO
- Accessibility checks must pass (WCAG AA)

## Customization

Each agent and workflow can be customized by editing the respective markdown files. Common customizations:
- Adjust review severity levels
- Add project-specific patterns
- Configure custom test scenarios
- Define team-specific standards

## Directory Structure
```
├── agents/              # Agent configurations
├── mcp/                # MCP server setups
├── examples/           # Usage examples
├── workflow.md         # Workflow definitions
├── CLAUDE.md          # This file
└── .claude.json       # MCP configuration
```

## Support

For issues or improvements to these templates:
- Repository: [claude-code-templates](https://github.com/maartenesser/claude-code-templates)
- Documentation: See README.md for detailed setup

## Project Context

### Context Files
**IMPORTANT**: Before performing any review or implementation, always consult the project context files for standards and guidelines:

- **[Design Principles](../context/design-principles.md)**: Core design philosophy, visual standards, component patterns, and quality checklist
- **[Style Guide](../context/style-guide.md)**: Visual language, typography with complete font stacks, comprehensive color systems, layout systems, animations, and responsive design guidelines
- **[Technical Standards](../context/technical-standards.md)**: Code quality standards, TypeScript guidelines, React patterns, security practices, and testing requirements
- **[S-Tier SaaS Design Checklist](../context/saas-design-checklist.md)**: World-class design standards inspired by Stripe, Airbnb, and Linear - comprehensive excellence criteria for UI/UX
- **[Component Library](../context/component-library.md)**: Complete specifications for all UI components including Container, Button, Card, Header, Footer, Hero, and form elements with implementation examples
- **[Implementation Patterns](../context/implementation-patterns.md)**: Next.js 15 App Router patterns, Tailwind CSS configuration, shadcn/ui integration, performance optimization techniques, and security patterns

### Context Validation
All reviews must validate against the documented standards in context files:
1. Code changes must comply with technical standards
2. UI implementations must follow design principles
3. Visual elements must adhere to the style guide (fonts, colors, typography)
4. Components must match specifications in component library
5. Implementation must follow Next.js 15 and Tailwind patterns
6. Interfaces must meet S-tier SaaS excellence criteria
7. Git commits must follow documented conventions
8. Tests must meet coverage requirements
9. Accessibility must meet WCAG 2.1 AA+ standards
10. Performance must meet Core Web Vitals targets
11. Component usage must follow library patterns
12. Tailwind classes must be organized per implementation patterns

## Notes for Claude

When working in a project with these templates:
1. **ALWAYS check context files first** - They are the source of truth for project standards
2. Always check for project-specific CLAUDE.md files in subdirectories
3. Prioritize the most specific (nested) configuration
4. Use Playwright MCP for any UI-related tasks
5. Invoke specialized agents for their designated domains
6. Follow the defined workflows for consistency
7. Reference specific context guidelines when providing feedback
8. Validate against modern tech stack requirements (Next.js 15, Tailwind, shadcn/ui)
9. Check for proper Server/Client component separation in Next.js
10. Ensure Tailwind utility classes are organized by category
11. Verify shadcn/ui components are properly composed
12. Validate Core Web Vitals performance metrics