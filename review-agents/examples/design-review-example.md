# Design Review Examples

## Example 1: Login Page Review

### Command
```
@design-review Review the login page for accessibility and mobile responsiveness
```

### Agent Response
```markdown
## Design Review Report - Login Page

### Summary
- **Component/Page**: Login Page (/login)
- **Review Date**: 2024-01-15
- **Overall Score**: 78/100
- **Critical Issues**: 2

### Responsive Design
✅ Mobile (375px): Pass with minor issues
✅ Tablet (768px): Pass
⚠️ Desktop (1440px): Layout shift detected

### Accessibility
- **WCAG Compliance**: AA (Partial)
- **Contrast Issues**: 1
- **Keyboard Navigation**: Pass

### Critical Issues 🔴

1. **Missing Form Labels**
   - Location: Email input field
   - Impact: Screen readers cannot identify field purpose
   - Fix: Add `<label for="email">` or `aria-label`

2. **Insufficient Color Contrast**
   - Location: Placeholder text
   - Current: 2.8:1
   - Required: 4.5:1
   - Fix: Use #666666 instead of #999999

### Recommendations
1. Add visible focus indicators to form inputs
2. Increase touch target size for mobile (currently 38px, needs 44px)
3. Implement loading state for submit button
4. Add error message announcements for screen readers
```

## Example 2: Dashboard Component Review

### Command
```
@design-review Validate dashboard component against design system
```

### Agent Response
```markdown
## Design Review Report - Dashboard Component

### Visual Consistency
- **Brand Compliance**: 92%
- **Typography**: 2 deviations found
- **Spacing**: Inconsistent margins

### Issues by Severity

#### 🟡 Major
1. **Typography Mismatch**
   - H2 headers using 1.875rem instead of 2rem
   - Body text line-height is 1.4 instead of 1.5

2. **Spacing Inconsistency**
   - Card margins: 20px (should be 24px per 8px grid)
   - Section padding: 30px (should be 32px)

#### 🔵 Minor
1. Border radius on cards (4px) differs from design system (8px)
2. Shadow depth lighter than specification

### Visual Evidence
![Dashboard Screenshot](./screenshots/dashboard-review.png)
- Red annotations show spacing issues
- Yellow highlights indicate typography deviations
```

## Example 3: E-commerce Product Grid

### Command
```
@design-review Check product grid responsive behavior and performance
```

### Agent Response
```markdown
## Design Review Report - Product Grid

### Performance Metrics
- Initial Load: 2.3s
- CLS Score: 0.08 (Good)
- Image Optimization: Needs improvement

### Responsive Behavior
- **375px**: 1 column ✅
- **768px**: 2 columns ✅
- **1024px**: 3 columns ✅
- **1440px**: 4 columns ✅

### Issues Found

#### Performance 🟠
1. **Unoptimized Images**
   - Loading 2MB images for 200px thumbnails
   - Recommendation: Use responsive images with srcset
   - Example:
   ```html
   <img
     srcset="product-200.jpg 200w,
             product-400.jpg 400w"
     sizes="(max-width: 768px) 100vw, 25vw"
   />
   ```

2. **Missing Lazy Loading**
   - All 50 products load immediately
   - Add `loading="lazy"` to images below fold

#### Accessibility 🔴
1. **Missing Alt Text**
   - Product images lack descriptive alt text
   - Current: alt=""
   - Needed: alt="Blue Cotton T-Shirt - Front View"
```

## Example 4: Form Validation Review

### Command
```
@design-review Test form validation UX and error handling
```

### Agent Response
```markdown
## Design Review Report - Form Validation

### Validation Patterns
✅ Real-time validation implemented
✅ Clear error messages
⚠️ Error announcement missing
❌ Success feedback not visible

### Accessibility Issues
1. **Error Messages Not Announced**
   - Add `role="alert"` to error containers
   - Use `aria-live="polite"` for field-level errors

2. **Color-Only Error Indication**
   - Currently using red border only
   - Add error icon for colorblind users

### UX Improvements
1. Show field requirements upfront
2. Add progress indicator for multi-step forms
3. Implement inline success checkmarks
4. Provide helpful error recovery suggestions

### Code Suggestion
```jsx
<div className="field">
  <input
    aria-invalid={hasError}
    aria-describedby="email-error"
  />
  {hasError && (
    <span
      id="email-error"
      role="alert"
      className="error"
    >
      <Icon name="error" />
      Please enter a valid email address
    </span>
  )}
</div>
```
```

## Example 5: Dark Mode Implementation

### Command
```
@design-review Verify dark mode implementation across all components
```

### Agent Response
```markdown
## Design Review Report - Dark Mode

### Coverage
- Components Tested: 24/24
- Full Support: 20
- Partial Support: 3
- No Support: 1

### Issues Found

#### Critical 🔴
1. **Chart Component Invisible**
   - Chart colors don't adapt to dark background
   - Implement theme-aware color schemes

#### Major 🟠
1. **Poor Contrast in Dark Mode**
   - Secondary text: 3.2:1 (needs 4.5:1)
   - Link color too similar to body text

2. **Images Without Dark Variants**
   - Logo doesn't switch to light version
   - Illustrations have white backgrounds

### CSS Implementation Review
```css
/* Current */
.card {
  background: white;
  color: black;
}

/* Recommended */
.card {
  background: var(--surface-1);
  color: var(--text-1);
}

:root {
  --surface-1: white;
  --text-1: black;
}

[data-theme="dark"] {
  --surface-1: #1a1a1a;
  --text-1: #e0e0e0;
}
```

### Quick Wins
1. Add `color-scheme: dark` to dark mode CSS
2. Use CSS custom properties for all colors
3. Test with `prefers-contrast: high`
4. Add theme toggle animation
```

## Common Commands Reference

### Basic Reviews
```bash
@design-review Review [page/component]
@design-review Check accessibility of [element]
@design-review Validate responsive design
@design-review Compare against mockup [url]
```

### Specific Checks
```bash
@design-review Test color contrast ratios
@design-review Verify WCAG AA compliance
@design-review Check mobile touch targets
@design-review Validate loading states
@design-review Review animation performance
```

### Comparative Analysis
```bash
@design-review Compare before and after screenshots
@design-review Check design system compliance
@design-review Validate brand consistency
```