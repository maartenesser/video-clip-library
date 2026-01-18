# Context Template

## Overview
This directory contains essential context files that guide AI agents and developers in maintaining consistent standards across your project. These files serve as the source of truth for design principles, coding standards, and style guidelines.

## Context Files

### 1. Design Principles (`design-principles.md`)
Defines the core design philosophy and fundamental principles for your project:
- Core philosophy and visual design standards
- Component design patterns
- Interaction principles
- Accessibility requirements
- Quality checklists

### 2. Style Guide (`style-guide.md`)
Comprehensive visual language and styling specifications:
- Typography system and font stacks
- Color palettes and usage rules
- Layout and spacing systems
- Component styles and patterns
- Animation and transition guidelines
- Responsive design breakpoints

### 3. Technical Standards (`technical-standards.md`)
Code quality and development standards:
- TypeScript guidelines and patterns
- React/Next.js best practices
- Security standards and requirements
- Performance optimization targets
- Testing requirements and coverage
- Git conventions and workflow

### 4. S-Tier SaaS Design Checklist (`saas-design-checklist.md`)
World-class design standards inspired by industry leaders:
- Core design philosophy from Stripe, Airbnb, Linear
- Comprehensive UI component excellence criteria
- Module-specific design patterns (data tables, multimedia, config panels)
- WCAG 2.1 AA+ accessibility requirements
- Performance standards and Core Web Vitals
- Interaction design and micro-animation guidelines
- Quality gates and review criteria

## Integration Instructions

### Quick Start

1. **Copy context files to your project**:
```bash
# From your project root
cp -r path/to/templates/context .claude/context/
# Or place them in your project root
cp -r path/to/templates/context ./context/
```

2. **Update your CLAUDE.md** to reference context files:
```markdown
## Project Context
Before any implementation or review, consult:
- [Design Principles](./context/design-principles.md)
- [Style Guide](./context/style-guide.md)
- [Technical Standards](./context/technical-standards.md)
```

3. **Configure review agents** to check context:
   - Code reviews validate against technical standards
   - Design reviews check style guide compliance
   - All commits follow Git conventions

### Customization

#### Adapting to Your Project

1. **Design Principles**:
   - Update color system to match your brand
   - Modify spacing units for your design system
   - Add project-specific component patterns
   - Adjust accessibility requirements

2. **Style Guide**:
   - Replace color palette with brand colors
   - Update typography scale
   - Modify breakpoints for your needs
   - Add custom animation guidelines

3. **Technical Standards**:
   - Adjust TypeScript strictness
   - Add framework-specific patterns
   - Update security requirements
   - Modify testing thresholds

#### Example Customizations

**For a SaaS Application**:
```markdown
# In technical-standards.md
- Add multi-tenancy patterns
- Include API versioning standards
- Add subscription/billing guidelines

# In design-principles.md
- Add dashboard design patterns
- Include data visualization principles
- Add onboarding flow standards
```

**For an E-commerce Site**:
```markdown
# In style-guide.md
- Add product card specifications
- Include checkout flow patterns
- Add promotional banner styles

# In design-principles.md
- Add conversion optimization principles
- Include trust signals placement
- Add mobile commerce guidelines
```

## Using Context with AI Agents

### With Claude Code

When using Claude Code or other AI assistants, reference context files in your prompts:

```bash
# Good prompt that references context
"Implement the login form following our design-principles.md and style-guide.md"

# Better prompt with specific context
"Create a button component that follows the button patterns in style-guide.md,
using the color system defined there"
```

### With Review Agents

Review agents automatically check context compliance:

```bash
@code-review  # Automatically checks technical-standards.md
@design-review  # Automatically validates against design-principles.md and style-guide.md
```

## Best Practices

### 1. Keep Context Updated
- Review and update context files quarterly
- Document changes in a CHANGELOG
- Notify team of significant updates
- Version control all changes

### 2. Make Context Accessible
- Place in a consistent location
- Link from main documentation
- Include in onboarding materials
- Reference in code reviews

### 3. Use Context Actively
- Reference in PR templates
- Include in design reviews
- Check during implementation
- Validate in CI/CD pipeline

### 4. Maintain Consistency
- Single source of truth
- No conflicting standards
- Clear precedence rules
- Regular audits

## Context Validation

### Manual Checks
- [ ] Colors match defined palette
- [ ] Typography follows scale
- [ ] Spacing uses base unit
- [ ] Code follows patterns
- [ ] Git commits follow convention

### Automated Validation
```json
// .claude/config.json
{
  "contextValidation": {
    "enabled": true,
    "files": [
      "./context/design-principles.md",
      "./context/style-guide.md",
      "./context/technical-standards.md"
    ],
    "enforceStandards": true
  }
}
```

## Troubleshooting

### Common Issues

**Context not being followed**:
- Ensure files are in correct location
- Check that agents have file access
- Verify CLAUDE.md references are correct

**Conflicting standards**:
- Technical standards take precedence for code
- Design principles override for UX decisions
- Document exceptions clearly

**Outdated context**:
- Set up regular review schedule
- Track framework/library updates
- Monitor industry best practices

## Examples

### Example 1: Component Development
```typescript
// Following technical-standards.md TypeScript patterns
interface ButtonProps {
  variant: 'primary' | 'secondary';  // From style-guide.md
  size: 'sm' | 'md' | 'lg';          // From design-principles.md
  onClick: () => void;
  children: React.ReactNode;
}

// Component follows React patterns from technical-standards.md
export function Button({ variant, size, onClick, children }: ButtonProps) {
  // Implementation following context guidelines
}
```

### Example 2: Design Implementation
```css
/* Following style-guide.md color system */
.button-primary {
  background: var(--color-primary);  /* From context */
  padding: var(--space-3) var(--space-4);  /* 4px base unit */
  border-radius: 6px;  /* From component patterns */
}
```

## Support

For questions or improvements to context templates:
- Open an issue in the [claude-code-templates](https://github.com/maartenesser/claude-code-templates) repository
- Submit PRs with enhancements
- Share your customizations with the community

## Next Steps

1. Review and customize each context file
2. Integrate with your CI/CD pipeline
3. Train your team on context usage
4. Set up regular context review cycles
5. Monitor compliance and iterate