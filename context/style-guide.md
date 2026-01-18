# Style Guide

## Visual Language

### Brand Personality
- **Modern**: Clean lines, ample whitespace, contemporary typography
- **Professional**: Trustworthy, reliable, competent
- **Approachable**: Friendly without being casual, clear communication
- **Technical**: Precise, accurate, detail-oriented
- **Results-Driven**: Focus on impact, transformation, and measurable outcomes

## Technology Stack

### Core Technologies
```json
{
  "framework": "Next.js 15 (App Router)",
  "styling": "Tailwind CSS with custom configuration",
  "components": "shadcn/ui + Radix UI",
  "icons": "Lucide React",
  "animations": "Framer Motion + Tailwind CSS animations",
  "fonts": "Inter (Google Fonts)",
  "images": "Next/Image with optimization"
}
```

## Typography

### Font Stack
```css
/* Primary Font - Inter for modern, clean appearance */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
             Cantarell, 'Helvetica Neue', sans-serif;

/* Monospace for code */
font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
```

### Font Import
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&display=swap');
```

### Type Hierarchy
```css
/* Hero headlines - Responsive scaling for maximum impact */
.hero-title {
  @apply text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl;
  @apply font-bold leading-tight tracking-tight;
  line-height: 1.1;
}

/* Page headings - Primary page titles */
.page-title {
  @apply text-3xl sm:text-4xl md:text-5xl;
  @apply font-bold leading-tight;
}

/* Section headings - Major content sections */
.section-title {
  @apply text-2xl sm:text-3xl font-bold text-center mb-4;
  @apply tracking-tight;
}

/* Subsection headings - Secondary content divisions */
.subsection-title {
  @apply text-xl sm:text-2xl font-semibold mb-3;
}

/* Card headings - Component titles */
.card-title {
  @apply text-lg sm:text-xl font-semibold;
}

/* Body text - Primary content */
.body-text {
  @apply text-base sm:text-lg leading-relaxed;
  @apply mx-auto max-w-3xl;
  line-height: 1.6;
}

/* Small text - Captions and metadata */
.small-text {
  @apply text-sm leading-normal;
  @apply text-gray-600;
}

/* Micro text - Labels and hints */
.micro-text {
  @apply text-xs leading-normal;
  @apply text-gray-500;
}
```

### Text Guidelines
- Maximum line length: 65-75 characters
- Paragraph spacing: 1em minimum
- Heading margins: More space above than below
- List item spacing: 0.5em between items
- Line height: 1.6 for body text
- Font weights: 300 (light), 400 (regular), 500 (medium), 700 (bold), 900 (black)

## Color System

### Tailwind Color Configuration
```typescript
colors: {
  primary: {
    50: '#f0f3f9',
    100: '#dce3f1',
    200: '#bbc9e4',
    300: '#92a7d1',
    400: '#6a83bc',
    500: '#4e67a7',
    600: '#1a2f6c',  // Primary brand color
    700: '#162555',
    800: '#121e45',
    900: '#0f1937',
  },
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eaeaea',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  // Semantic colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  }
}
```

### Primary Palette
- **Primary Action**: `primary-600` (#1a2f6c) - CTAs, links, active states
- **Primary Hover**: `primary-700` (#162555) - Hover states
- **Text Primary**: `gray-900` (#171717) - Headings, body text
- **Text Secondary**: `gray-600` (#525252) - Captions, metadata
- **Background**: White (#ffffff) - Main background
- **Surface**: `gray-50` (#fafafa) - Cards, sections

### Semantic Colors
- **Success**: Green (#0cad00) - Confirmations, success states
- **Warning**: Amber (#f5a623) - Warnings, cautions
- **Error**: Red (#e00) - Errors, destructive actions
- **Info**: `primary-600` - Information, tips

### Color Application Rules
- Never use color alone to convey meaning
- Maintain 4.5:1 contrast ratio minimum (WCAG AA)
- Test with color blindness simulators
- Use semantic colors consistently
- Apply hover states with 10% darkness increase

## Layout & Spacing

### Container System
```tsx
// Container sizes for different content types
const containerSizes = {
  sm: "max-w-3xl",   // 768px - Centered content
  md: "max-w-5xl",   // 1024px - Standard content
  lg: "max-w-7xl",   // 1280px - Wide content
  xl: "max-w-[2000px]" // Full width with max limit
}
```

### Breakpoints
```css
/* Mobile First Responsive Design */
@media (min-width: 375px) { /* Mobile */ }
@media (min-width: 640px) { /* sm - Large mobile */ }
@media (min-width: 768px) { /* md - Tablet */ }
@media (min-width: 1024px) { /* lg - Desktop */ }
@media (min-width: 1280px) { /* xl - Large desktop */ }
@media (min-width: 1440px) { /* 2xl - Wide screen */ }
@media (min-width: 1920px) { /* 3xl - Ultra wide */ }
```

### Spacing System (4px Base Unit)
```css
/* Tailwind spacing scale */
--space-0: 0;        /* 0px */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-20: 5rem;    /* 80px */
```

### Grid Patterns
```css
/* 3-column responsive grid */
.grid-3col {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8;
}

/* Logo grid */
.logo-grid {
  @apply grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8;
  @apply items-center justify-items-center;
}

/* Card grid */
.card-grid {
  @apply grid gap-8 md:grid-cols-2 lg:grid-cols-3;
}
```

## Component Styles

**Note**: For complete component specifications and implementation examples, refer to [component-library.md](./component-library.md). This section provides the core styling patterns used across all components.

### Button Component
```tsx
// Button variants using class-variance-authority
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500",
        outline: "border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500",
        secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500",
        ghost: "text-primary-600 hover:bg-primary-50"
      },
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
)
```

### Card Component
```css
/* Card styles */
.card {
  @apply rounded-xl bg-white p-6 shadow-sm;
  @apply transition-all duration-200;
}

.card-hover {
  @apply hover:shadow-md hover:scale-105;
}

/* Card with border */
.card-bordered {
  @apply border border-gray-200;
}
```

### Form Elements
```css
/* Input fields */
.input {
  @apply border border-gray-300 rounded-lg px-4 py-2;
  @apply text-base leading-normal;
  @apply transition-colors duration-200;
  @apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent;
}

/* Input states */
.input-error {
  @apply border-red-500 focus:ring-red-500;
}

.input-success {
  @apply border-green-500 focus:ring-green-500;
}

.input-disabled {
  @apply bg-gray-100 cursor-not-allowed opacity-60;
}
```

### Navigation
```css
/* Header navigation */
.nav-header {
  @apply fixed top-0 z-50 w-full;
  @apply bg-white/90 backdrop-blur-sm;
  @apply transition-all duration-200;
}

.nav-header-scrolled {
  @apply border-b border-gray-200/70 bg-white shadow-sm;
}

/* Navigation links */
.nav-link {
  @apply font-medium text-primary-900;
  @apply transition-colors duration-200;
  @apply hover:text-primary-600;
}

.nav-link-active {
  @apply text-primary-600 font-semibold;
}
```

## Icons & Images

### Icon Guidelines
- Use Lucide React for consistency
- Default size: 24x24px (h-6 w-6)
- Match icon color to text color
- Consistent stroke width (2px)
- Include aria-labels for accessibility

### Image Optimization
```tsx
// Always use Next.js Image component
<Image
  src="/images/hero/hero-image.jpg"
  alt="Descriptive alt text"
  width={1920}
  height={1080}
  priority // for above-fold images
  placeholder="blur" // with blurDataURL
  className="object-cover"
/>
```

### Image Guidelines
- Use WebP format when possible
- Provide responsive image sizes
- Implement lazy loading for below-fold images
- Include descriptive alt text
- Optimize file sizes (< 200KB for heroes)

## Animation & Transitions

### Animation Keyframes
```css
@keyframes infinite-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes float-0 {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.05); }
}

@keyframes float-1 {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(10px) scale(1.05); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

### Animation Classes
```css
/* Continuous animations */
.animate-infinite-scroll {
  animation: infinite-scroll 20s linear infinite;
}

.animate-float-0 {
  animation: float-0 4s ease-in-out infinite;
}

.animate-float-1 {
  animation: float-1 4s ease-in-out infinite 2s;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Entry animations */
.animate-fade-in {
  animation: fade-in 0.5s ease-in-out;
}

.animate-fade-in-up {
  animation: fade-in-up 0.5s ease-out;
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}

/* Pause on hover */
.animate-infinite-scroll:hover,
.animate-float-0:hover,
.animate-float-1:hover {
  animation-play-state: paused;
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Duration Guidelines
- **Micro-interactions**: 100-200ms
- **Page transitions**: 200-300ms
- **Complex animations**: 300-500ms
- **Stagger delay**: 50-100ms between items

### Easing Functions
```css
/* Standard easing curves */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-spring: cubic-bezier(0.5, 1.25, 0.75, 1.25);
```

### Animation Principles
- Purpose over decoration
- Respect prefers-reduced-motion
- Keep it subtle and quick
- Use transform and opacity for performance
- Avoid animating layout properties

## Responsive Design

### Mobile Considerations
- Touch targets minimum 44x44px
- Thumb-friendly navigation placement
- Avoid hover-only interactions
- Test on real devices
- Mobile-first development approach

### Tablet Optimization
- Optimize for both orientations
- Consider two-column layouts
- Maintain touch-friendly sizing
- Test split-screen scenarios

### Desktop Enhancement
- Take advantage of hover states
- Use multi-column layouts effectively
- Consider mouse-specific interactions
- Optimize for larger viewports
- Implement keyboard shortcuts

## Accessibility Standards

### Focus Management
```css
/* Custom focus styles */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Skip to content link */
.skip-link {
  @apply absolute top-0 left-0 -translate-y-full;
  @apply focus:translate-y-0;
  @apply bg-primary-600 text-white p-2 rounded;
}
```

### ARIA Guidelines
- Use semantic HTML first
- Add ARIA labels for icons
- Include role attributes when needed
- Test with screen readers
- Announce dynamic content changes

### Screen Reader Support
```tsx
// Always include proper labels
<button aria-label="Open navigation menu">
  <Menu className="h-6 w-6" />
</button>

// Descriptive alt text
<img
  src="/logo.png"
  alt="Company logo - Home"
/>

// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Keyboard Navigation
- All interactive elements reachable via Tab
- Logical tab order
- Skip links for navigation
- Escape key closes modals/dropdowns
- Arrow keys for menu navigation

## Performance Guidelines

### Core Web Vitals Targets
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTFB** (Time to First Byte): < 600ms

### Loading States
```tsx
// Loading spinner component
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
  </div>
)

// Skeleton loader
export const SkeletonLoader = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
  </div>
)
```

### Performance Optimization
- Minimize CSS bundle size
- Use CSS-in-JS sparingly
- Optimize critical rendering path
- Lazy load non-critical CSS
- Implement code splitting
- Use dynamic imports for heavy components

## SEO Guidelines

### Meta Tags Structure
```tsx
export const metadata: Metadata = {
  title: 'Page Title | Site Name',
  description: 'Page description (150-160 characters)',
  keywords: 'relevant, keywords, separated',
  openGraph: {
    title: 'OG Title',
    description: 'OG Description',
    url: 'https://example.com',
    siteName: 'Site Name',
    images: [{
      url: '/og-image.jpg',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@handle',
  }
}
```

### Semantic HTML
```tsx
// Proper heading hierarchy
<main>
  <h1>Page Title</h1>
  <section>
    <h2>Section Title</h2>
    <article>
      <h3>Article Title</h3>
    </article>
  </section>
</main>
```

## Code Organization

### CSS Class Order (Tailwind)
```tsx
<div className="
  /* Layout */
  flex flex-col gap-4
  /* Sizing */
  w-full max-w-lg
  /* Spacing */
  p-6 mx-auto
  /* Visual */
  bg-white rounded-lg shadow-md
  /* Typography */
  text-gray-900 font-medium
  /* Interactive */
  hover:shadow-lg transition-shadow cursor-pointer
  /* State */
  disabled:opacity-50
">
```

### Component File Structure
```
ComponentName/
├── index.tsx           # Main component
├── ComponentName.tsx   # Component logic
├── types.ts           # TypeScript interfaces
├── styles.module.css  # Component styles (if needed)
└── __tests__/         # Component tests
```

## Testing Checklist

### Visual QA
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing (iOS, Android)
- [ ] Different viewport sizes (375px to 1920px)
- [ ] Print stylesheet if applicable
- [ ] Dark mode support if applicable
- [ ] High contrast mode compatibility

### Accessibility Testing
- [ ] Keyboard navigation complete
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Color contrast validation (WCAG AA)
- [ ] Focus indicators visible
- [ ] Alt text for all images
- [ ] Form labels properly associated
- [ ] Error messages clear and accessible

### Performance Testing
- [ ] Page load time < 3s on 3G
- [ ] First contentful paint < 1.5s
- [ ] No layout shifts (CLS < 0.1)
- [ ] Optimized image sizes
- [ ] CSS and JS minified
- [ ] Lighthouse score > 90

## Implementation Examples

### Hero Section Pattern
```tsx
<section className="relative h-screen overflow-hidden">
  {/* Background with overlay */}
  <div className="absolute inset-0">
    <Image src="/hero.jpg" alt="" fill className="object-cover" priority />
    <div className="absolute inset-0 bg-gradient-to-br from-primary-900/95 via-primary-900/90 to-primary-800/95" />
  </div>

  {/* Content */}
  <div className="relative z-10 flex h-full items-center">
    <Container size="lg">
      <h1 className="hero-title text-white mb-6">{title}</h1>
      <p className="body-text text-gray-100 mb-8">{subtitle}</p>
      <Button size="lg">{cta}</Button>
    </Container>
  </div>
</section>
```

### Card Grid Pattern
```tsx
<section className="py-20 bg-gray-50">
  <Container>
    <h2 className="section-title mb-12">{sectionTitle}</h2>
    <div className="card-grid">
      {items.map((item) => (
        <Card key={item.id} hover>
          <CardContent item={item} />
        </Card>
      ))}
    </div>
  </Container>
</section>
```

## Brand Voice & Tone

### Content Guidelines
- **Clear and Direct**: No jargon, straight to the point
- **Confident**: Authoritative without being arrogant
- **Inspiring**: Focus on transformation and results
- **Practical**: Actionable insights, not theory
- **Personal**: Human touch, not corporate speak

### Microcopy Patterns
- CTAs: Action-oriented ("Get Started", "Book Now")
- Errors: Helpful and specific ("Please enter a valid email")
- Success: Celebratory but brief ("Success! Check your inbox")
- Loading: Informative ("Loading your dashboard...")
- Empty states: Encouraging ("No results yet. Start by...")

## Development Workflow

### Pre-Development Checklist
- [ ] Design approved and in Figma/design tool
- [ ] Component inventory complete
- [ ] API endpoints documented
- [ ] Content and copy finalized
- [ ] Image assets optimized

### During Development
- [ ] Follow mobile-first approach
- [ ] Use semantic HTML
- [ ] Implement accessibility from start
- [ ] Test across breakpoints
- [ ] Validate with design regularly

### Pre-Launch Checklist
- [ ] All responsive breakpoints tested
- [ ] Accessibility audit passed
- [ ] Performance budget met
- [ ] SEO meta tags in place
- [ ] Forms tested and working
- [ ] Error pages implemented
- [ ] Analytics configured
- [ ] Legal pages added (Privacy, Terms)