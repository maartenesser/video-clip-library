# Claude Code Workflows

## Design Review Workflow

### Purpose
Comprehensive UI/UX review process leveraging Playwright MCP for visual validation and accessibility testing.

### Trigger
- Manual: `@design-review [component/page name]`
- Automatic: On PR with UI changes
- Scheduled: Daily design regression tests

### Steps

#### 0. Context & Standards Loading
```
- Load all context files (design-principles.md, style-guide.md, saas-design-checklist.md)
- Load component-library.md for component specifications
- Load implementation-patterns.md for Next.js/Tailwind patterns
- Identify relevant S-tier standards for this component
- Note specific excellence criteria that apply
- Prepare validation checklist from context
- Set up performance budgets and metrics
```

#### 1. Live Environment First
```
- Launch Playwright browser instance
- Navigate to live preview/staging environment
- Set initial viewport (1440x900 desktop)
- Open console for error monitoring
- Execute primary user flow
- Test all interactive states
- Document perceived performance
```

#### 2. Responsive Design Validation
```
- Test on mobile viewport (375px)
- Test on tablet viewport (768px)
- Test on desktop viewport (1440px)
- Test on large desktop (1920px)
- Verify layout integrity at each breakpoint
- Check for content overflow or truncation
```

#### 3. Accessibility Audit (WCAG 2.1 AA+)
```
- Verify WCAG 2.1 AA+ compliance
- Check color contrast ratios (4.5:1 normal, 3:1 large)
- Complete keyboard navigation testing
- Tab order verification
- Focus indicator visibility
- Screen reader compatibility testing
- ARIA implementation review
- Form label associations
- Error message announcements
- Skip links presence
```

#### 4. Visual Consistency
```
- Compare against design system (style-guide.md)
- Validate typography hierarchy per context standards
- Check spacing and alignment (4px base unit system)
- Verify color palette compliance with defined color system
- Validate icon usage and sizing
- Ensure brand personality alignment
```

#### 5. Performance Check
```
- Measure initial load time (<3s on 3G)
- Check for layout shifts (CLS < 0.1)
- Verify image optimization (Next/Image usage)
- Test animation performance (60fps)
- Validate lazy loading implementation
- Check Core Web Vitals (LCP < 2.5s, FID < 100ms)
- Verify font optimization (next/font)
- Test bundle size and code splitting
```

#### 6. S-Tier Excellence Validation
```
- Cross-reference with saas-design-checklist.md
- Validate against world-class standards
- Check module-specific excellence criteria
- Assess overall polish and craft
- Calculate excellence score
```

#### 7. Report Generation
```
- Start with positive observations
- Use triage matrix (Blocker/High/Medium/Nitpick)
- Provide visual evidence (screenshots)
- Focus on user impact, not prescriptions
- Generate excellence score breakdown
- Create annotated screenshots
- Generate comprehensive accessibility report
- Include performance metrics
```

### Example Usage
```bash
# Review a specific component
@design-review Review the new dashboard component for mobile responsiveness

# Full page audit
@design-review Perform complete design audit on /login page

# Compare against mockup
@design-review Compare implementation against Figma mockup [url]
```

---

## Code Review Workflow

### Purpose
Automated code quality, security, and best practices validation for pull requests.

### Trigger
- Automatic: On PR creation/update
- Manual: `@code-review [file/module]`
- Pre-commit: Local validation

### Steps

#### 0. Context Validation
```
- Load technical-standards.md
- Load component-library.md for component patterns
- Load implementation-patterns.md for Next.js/Tailwind best practices
- Identify applicable coding standards
- Note TypeScript guidelines
- Review security requirements
- Check Git conventions
- Validate component usage patterns
```

#### 1. Static Analysis
```
- Run linting checks
- Check type safety per technical standards
- Validate import structure
- Check for unused code
- Verify naming conventions against context guidelines
```

#### 2. Security Scan
```
- Check for hardcoded secrets
- Validate input sanitization
- Check for SQL injection risks
- Verify authentication logic
- Scan for XSS vulnerabilities
- Check dependency vulnerabilities
```

#### 3. Architecture Review
```
- Validate design patterns against technical standards
- Check SOLID principles compliance
- Verify dependency injection
- Review module boundaries
- Check for circular dependencies
- Validate React/Next.js patterns from context
```

#### 4. Performance Analysis
```
- Identify N+1 queries
- Check for memory leaks
- Validate caching strategy
- Review algorithm complexity
- Check bundle size impact
```

#### 5. Test Coverage
```
- Verify unit test coverage (>80%)
- Check integration test presence
- Validate test quality (Jest/Testing Library)
- Review edge case handling
- Check mock usage
- Verify E2E test scenarios (Playwright)
- Check component testing (React Testing Library)
- Validate API route testing
```

#### 6. Documentation Check
```
- Verify inline documentation (JSDoc/TSDoc)
- Check API documentation
- Validate README updates
- Review changelog entries
- Check TypeScript type definitions
- Verify component prop documentation
- Check Storybook stories (if applicable)
- Validate context file compliance
```

### Example Usage
```bash
# Review specific module
@code-review Review the authentication module

# Security-focused review
@code-review Perform security audit on payment processing

# Performance review
@code-review Check performance implications of new data processing
```

---

## Testing Workflow

### Purpose
Automated test generation and execution using Playwright MCP for comprehensive coverage.

### Trigger
- Manual: `@test-workflow [feature/component]`
- Automatic: On code changes
- Scheduled: Nightly regression tests

### Steps

#### 1. Test Planning
```
- Analyze feature requirements
- Identify test scenarios
- Map user journeys
- Define test data needs
- Plan test environment
```

#### 2. Test Generation
```
- Generate unit tests from code
- Create integration test scenarios
- Build E2E test flows
- Generate edge case tests
- Create performance benchmarks
```

#### 3. Test Execution
```
- Run unit test suite
- Execute integration tests
- Perform E2E testing
- Run performance tests
- Execute accessibility tests
```

#### 4. Test Validation
```
- Verify test reliability
- Check for flaky tests
- Validate assertions
- Review test coverage
- Check test performance
```

#### 5. Reporting
```
- Generate coverage report
- Create test execution summary
- Document failed tests
- Provide fix suggestions
- Track test metrics
```

### Example Usage
```bash
# Generate tests for new feature
@test-workflow Generate comprehensive tests for user registration

# Run specific test suite
@test-workflow Execute E2E tests for checkout process

# Test with specific data
@test-workflow Run payment tests with international currencies
```

---

## Integration Workflow

### Purpose
Combined design and code review process for complete feature validation.

### Trigger
- Manual: `@integration-review [feature]`
- Automatic: On feature branch merge
- Milestone: Pre-release validation

### Steps

#### 1. Feature Analysis
```
- Review requirements document
- Analyze implementation scope
- Check feature completeness
- Validate acceptance criteria
```

#### 2. Code Quality Check
```
- Run code review workflow
- Validate architecture decisions
- Check performance impact
- Review security implications
```

#### 3. Design Validation
```
- Run design review workflow
- Compare against specifications
- Validate user experience
- Check accessibility compliance
```

#### 4. Integration Testing
```
- Test feature interactions
- Validate data flow
- Check system integration
- Test error scenarios
```

#### 5. Performance Validation
```
- Measure feature performance
- Check resource usage
- Validate scalability
- Test under load
```

#### 6. Final Report
```
- Consolidated review summary
- Risk assessment
- Deployment readiness score
- Required fixes list
- Optimization recommendations
```

### Example Usage
```bash
# Complete feature review
@integration-review Full review of shopping cart feature

# Pre-release validation
@integration-review Validate v2.0 release candidate

# Critical path review
@integration-review Review checkout flow end-to-end
```

---

## Custom Workflow Creation

### Template Structure
```markdown
## [Workflow Name]

### Purpose
[Clear description of what this workflow accomplishes]

### Trigger
- Manual: [Command format]
- Automatic: [Trigger conditions]

### Steps
#### 1. [Step Name]
```
- [Action 1]
- [Action 2]
```

### Example Usage
```bash
[Example commands]
```
```

### Best Practices

1. **Keep workflows focused**: Each workflow should have a single, clear purpose
2. **Make steps atomic**: Each step should be independently verifiable
3. **Provide clear output**: Always generate actionable reports
4. **Enable customization**: Allow parameters for workflow flexibility
5. **Maintain idempotency**: Workflows should be safely re-runnable

---

## Workflow Configuration

### Environment Variables
```bash
# Set review verbosity
CLAUDE_REVIEW_VERBOSITY=detailed|summary|minimal

# Configure auto-trigger
CLAUDE_AUTO_REVIEW=true|false

# Set severity threshold
CLAUDE_SEVERITY_THRESHOLD=critical|high|medium|low

# Technology stack configuration
CLAUDE_TECH_STACK=nextjs15|react|tailwind|shadcn

# Performance budget
CLAUDE_PERF_BUDGET_LCP=2500
CLAUDE_PERF_BUDGET_FID=100
CLAUDE_PERF_BUDGET_CLS=0.1
```

### Custom Rules
Add project-specific rules in `.claude/rules.json`:
```json
{
  "design": {
    "customChecks": ["brand-compliance", "animation-performance"]
  },
  "code": {
    "excludePatterns": ["*.generated.ts", "vendor/*"]
  }
}
```