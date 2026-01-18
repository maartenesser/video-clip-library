# Design Principles

## Core Philosophy
Build with intention. Every design decision should enhance the user experience while maintaining technical excellence.

## Fundamental Principles

### 1. Clarity and Simplicity
- **Clear Visual Hierarchy**: Use size, weight, and spacing to guide the eye
- **Minimalist Approach**: Remove unnecessary elements that don't serve a purpose
- **Intuitive Navigation**: Users should understand where they are and where they can go
- **Readable Typography**: Prioritize legibility with appropriate font sizes and line heights

### 2. Performance First
- **Fast Load Times**: Optimize images, minimize JavaScript, use efficient CSS
- **Smooth Interactions**: 60fps animations, no janky scrolling
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Optimized Assets**: Use modern image formats, lazy loading, code splitting

### 3. Accessibility as Default
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: WCAG AA compliance minimum (4.5:1 for normal text)
- **Focus Indicators**: Clear visual feedback for keyboard navigation
- **Touch Targets**: Minimum 44x44px for mobile interactions

### 4. Responsive Design
- **Mobile-First**: Design for small screens, enhance for larger ones
- **Fluid Typography**: Scale text appropriately across breakpoints
- **Flexible Layouts**: Content adapts gracefully to any screen size
- **Touch-Friendly**: Consider thumb reach and tap targets on mobile

### 5. Consistent Experience
- **Design System**: Unified color palette, spacing, and components
- **Predictable Patterns**: Similar elements behave similarly
- **Brand Coherence**: Maintain visual identity across all touchpoints
- **Error Handling**: Consistent, helpful error messages

## Visual Design Standards

### Color System
```css
/* Primary Colors */
--color-primary: #0070f3;
--color-primary-dark: #0051cc;

/* Neutral Colors */
--color-text: #000000;
--color-text-secondary: #666666;
--color-background: #ffffff;
--color-surface: #fafafa;
--color-border: #eaeaea;

/* Semantic Colors */
--color-success: #0cad00;
--color-warning: #f5a623;
--color-error: #e00;
```

### Typography Scale
```css
/* Base: 16px */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Spacing System
```css
/* 4px base unit */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Component Design Patterns

### Buttons
- **Variants**: Primary, outline, secondary, ghost
- **Sizes**: Small (h-9 px-3), Medium (h-10 px-4), Large (h-11 px-8)
- **States**: Default, hover, active, disabled, loading
- **Touch targets**: Minimum 44x44px on mobile
- **Loading indicator**: Spinner with disabled interaction
- **Focus ring**: 2px offset, primary color

```tsx
// Example button usage
<Button variant="primary" size="lg">
  Call to Action
</Button>
```

### Forms
- **Field structure**: Label → Input → Helper/Error text
- **Validation**: Real-time with debounce (300ms)
- **Error display**: Below field, red text, icon prefix
- **Success feedback**: Green checkmark, subtle animation
- **Required fields**: Asterisk (*) in label
- **Placeholder text**: Example format, not instructions

```tsx
// Form field pattern
<div className="space-y-2">
  <Label htmlFor="email">Email *</Label>
  <Input id="email" type="email" placeholder="name@example.com" />
  <p className="text-sm text-red-500">Please enter a valid email</p>
</div>
```

### Cards
- **Border radius**: 12px (rounded-xl) for modern feel
- **Shadow**: shadow-sm default, shadow-md on hover
- **Padding**: 24px (p-6) standard
- **Interactive**: Scale 1.05 on hover with transition
- **Content hierarchy**: Title → Meta → Body → Actions

```tsx
// Card pattern
<Card className="hover:shadow-md transition-all duration-200 hover:scale-105">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Navigation
- **Header**: Fixed/sticky with backdrop blur
- **Mobile menu**: Slide from right, full height
- **Active state**: Primary color, font-semibold
- **Breadcrumbs**: Chevron separators, truncate long paths
- **Skip links**: For accessibility, visible on focus

### Hero Sections
- **Height**: Full viewport (h-screen) or min-height
- **Background**: Image with gradient overlay
- **Content**: Centered, max-width constraint
- **Typography**: Large heading (4xl-6xl), readable subtitle
- **CTA placement**: Above fold, prominent styling

```tsx
// Hero pattern
<section className="relative h-screen">
  <div className="absolute inset-0">
    <Image src="/hero.jpg" alt="" fill className="object-cover" priority />
    <div className="absolute inset-0 bg-gradient-to-br from-primary-900/95" />
  </div>
  <div className="relative z-10 flex h-full items-center">
    <Container>
      <h1 className="text-5xl font-bold text-white">Headline</h1>
      <p className="text-xl text-gray-100">Subtitle</p>
      <Button size="lg">CTA</Button>
    </Container>
  </div>
</section>
```

### Logo Walls
- **Layout**: Grid with responsive columns
- **Logo treatment**: Grayscale by default, color on hover
- **Sizing**: Consistent height, auto width
- **Spacing**: Even distribution, center alignment
- **Animation**: Infinite scroll for many logos

### Testimonials
- **Layout**: Cards in grid or carousel
- **Content order**: Quote → Author → Role → Company
- **Visual**: Quote marks or icon, author photo optional
- **Typography**: Larger quote text, smaller attribution
- **Spacing**: Generous padding for readability

## Interaction Principles

### Feedback
- Immediate response to user actions
- Loading states for async operations
- Success/error messages
- Progress indicators for long processes

### Animation
- **Purpose-driven**: Every animation has a functional goal
- **Duration**:
  - Micro-interactions: 100-200ms
  - Page transitions: 200-300ms
  - Complex animations: 300-500ms
- **Easing curves**:
  - Enter: ease-out (decelerate)
  - Exit: ease-in (accelerate)
  - Both: ease-in-out (standard)
  - Spring: cubic-bezier(0.5, 1.25, 0.75, 1.25)
- **Performance**: Use transform and opacity only
- **Accessibility**: Respect prefers-reduced-motion

```css
/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Micro-interactions
- Subtle hover effects
- Focus rings for accessibility
- Button press feedback
- Form field activation

## Quality Checklist

### Before Shipping
- [ ] Tested on real devices (not just browser DevTools)
- [ ] Verified keyboard navigation
- [ ] Checked with screen reader
- [ ] Validated color contrast
- [ ] Tested with slow network
- [ ] Verified responsive breakpoints
- [ ] Checked for console errors
- [ ] Validated HTML semantics
- [ ] Optimized images
- [ ] Tested error states

### Design Review Points
1. **First Impression**:
   - Is the purpose immediately clear?
   - Does the hero communicate value?
   - Is the CTA prominent and actionable?

2. **Visual Hierarchy**:
   - Can users scan and understand quickly?
   - Are headings properly sized?
   - Is content grouped logically?
   - Do CTAs stand out appropriately?

3. **Consistency**:
   - Does it follow the style guide?
   - Are components used uniformly?
   - Is spacing consistent throughout?
   - Do interactions behave predictably?

4. **Accessibility**:
   - Can everyone use this effectively?
   - WCAG AA compliance (4.5:1 contrast)?
   - Keyboard navigation complete?
   - Screen reader friendly?
   - Touch targets 44x44px minimum?

5. **Performance**:
   - Does it feel fast and responsive?
   - Images optimized with Next/Image?
   - Animations smooth (60fps)?
   - Core Web Vitals passing?

6. **Mobile Experience**:
   - Is it truly mobile-optimized?
   - Touch-friendly interactions?
   - Readable without zooming?
   - Appropriate information density?

7. **Error Handling**:
   - What happens when things go wrong?
   - Clear error messages?
   - Recovery paths obvious?
   - Form validation helpful?

8. **Delight**:
   - Are there moments of thoughtful detail?
   - Smooth micro-interactions?
   - Personality in copy?
   - Surprising but useful features?

## References
- [Material Design Guidelines](https://material.io/design)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Refactoring UI](https://www.refactoringui.com/)