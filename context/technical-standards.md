# Technical Standards

## Code Quality Standards

### TypeScript Guidelines

#### Type Safety
- **Strict Mode**: Enable all strict type checking options
- **No Any**: Avoid `any` type, use `unknown` when type is truly unknown
- **Explicit Return Types**: Define return types for functions
- **Interface over Type**: Prefer interfaces for object shapes

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  // implementation
}

// Avoid
type User = any;
function getUser(id) {
  // implementation
}
```

#### Type Patterns
```typescript
// Use discriminated unions for state
type LoadingState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: Error };

// Use generics for reusable components
interface Props<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

// Use const assertions for literals
const ROUTES = {
  HOME: '/',
  BLOG: '/blog',
  ABOUT: '/about'
} as const;
```

### React Best Practices

#### Component Structure
```typescript
// Function components with TypeScript
interface ComponentProps {
  title: string;
  children: React.ReactNode;
}

export function Component({ title, children }: ComponentProps) {
  // Hooks at the top
  const [state, setState] = useState<string>('');
  
  // Effects after state
  useEffect(() => {
    // effect logic
  }, [dependency]);
  
  // Handlers before render
  const handleClick = () => {
    // handler logic
  };
  
  // Render last
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
```

#### React Patterns
- **Custom Hooks**: Extract reusable logic
- **Composition over Inheritance**: Use component composition
- **Memo Wisely**: Only memoize expensive computations
- **Key Stability**: Use stable, unique keys for lists

```typescript
// Custom hook example
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}
```

### Next.js 15 Standards

#### File Structure
```
app/
├── (routes)/          # Route groups for organization
├── api/               # API routes
├── components/        # Shared components
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # Layout components
│   ├── sections/     # Page sections
│   └── common/       # Common reusable components
├── lib/              # Utility functions
├── hooks/            # Custom hooks
├── types/            # TypeScript types
├── styles/           # Global styles
└── public/           # Static assets
    ├── images/       # Optimized images
    └── documents/    # PDFs, etc.
```

#### Data Fetching (App Router)
```typescript
// Server Components (default in Next.js 15)
export default async function Page() {
  const data = await fetchData(); // Direct async/await
  return <div>{data}</div>;
}

// Client Components (when needed)
'use client';
import { useState, useEffect } from 'react';

export default function InteractiveComponent() {
  const [data, setData] = useState();
  // Client-side logic with hooks
}

// Metadata API
export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description',
};

// Dynamic metadata
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `Dynamic ${params.slug}`,
  };
}
```

#### Performance Optimization
```typescript
// Dynamic imports for code splitting
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false
});

// Image optimization with Next/Image
import Image from 'next/image';
<Image
  src="/hero.jpg"
  alt="Description"
  width={1920}
  height={1080}
  priority // for LCP images
  placeholder="blur"
  blurDataURL={shimmer}
/>

// Font optimization
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });

// Streaming with Suspense
import { Suspense } from 'react';
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

### CSS/Tailwind Standards

#### Tailwind Configuration
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Custom theme extensions
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

#### Tailwind Best Practices
```tsx
// Use semantic grouping and organization
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

// Extract repeated patterns with cva (class-variance-authority)
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700',
        outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50',
      },
      size: {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
  }
);
```

#### CSS Organization
- Mobile-first responsive design
- Use CSS variables for theming
- Avoid inline styles except for dynamic values
- Group related utilities by category
- Use cn() utility for conditional classes:

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  isDisabled && 'disabled-classes'
)} />
```

### shadcn/ui Integration

#### Component Installation
```bash
# Install shadcn/ui components
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add form
```

#### Component Usage
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="outline">Click me</Button>
  </CardContent>
</Card>
```

### Framer Motion Standards

#### Animation Patterns
```tsx
import { motion } from 'framer-motion';

// Fade in animation
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Slide up animation
const slideUp = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

// Stagger children
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Usage
<motion.div
  initial="hidden"
  animate="visible"
  variants={fadeIn}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
```

#### Performance Guidelines
- Use `transform` and `opacity` for animations
- Avoid animating layout properties
- Use `will-change` sparingly
- Implement `prefers-reduced-motion`

### Testing Standards

#### Unit Testing
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

#### E2E Testing
```typescript
import { test, expect } from '@playwright/test';

test('user flow', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Get Started');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Security Standards

#### Data Validation
```typescript
// Always validate user input
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function validateUser(data: unknown) {
  return userSchema.parse(data);
}
```

#### Security Headers
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
];
```

#### Authentication Best Practices
- Use secure session management
- Implement proper CSRF protection
- Never store sensitive data client-side
- Use environment variables for secrets

### Performance Standards

#### Core Web Vitals Targets
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTFB** (Time to First Byte): < 600ms

#### Optimization Techniques
```typescript
// Image optimization
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // for above-fold images
  placeholder="blur"
/>

// Code splitting
const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  { 
    loading: () => <Skeleton />,
    ssr: false 
  }
);

// Memoization
const expensiveValue = useMemo(
  () => computeExpensiveValue(a, b),
  [a, b]
);
```

### Git Standards

#### Commit Messages
```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

#### Branch Naming
- `feature/description`
- `fix/issue-description`
- `hotfix/critical-fix`
- `refactor/component-name`

### Documentation Standards

#### Code Comments
```typescript
/**
 * Calculates the user's age from their birth date
 * @param birthDate - The user's date of birth
 * @returns The user's age in years
 */
function calculateAge(birthDate: Date): number {
  // Implementation
}
```

#### README Structure
1. Project Overview
2. Quick Start
3. Features
4. Installation
5. Configuration
6. Usage Examples
7. API Reference
8. Contributing
9. License

### Error Handling

#### Error Boundaries
```typescript
class ErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logErrorToService(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

#### Try-Catch Patterns
```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    // Handle error appropriately
    throw error;
  }
}
```

### Monitoring & Logging

#### Structured Logging
```typescript
const logger = {
  info: (message: string, meta?: object) => {
    console.log(JSON.stringify({ 
      level: 'info', 
      message, 
      timestamp: new Date().toISOString(),
      ...meta 
    }));
  },
  error: (message: string, error: Error, meta?: object) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...meta 
    }));
  }
};
```

## Modern Stack Integration

### Next.js 15 App Router
```typescript
// app/layout.tsx - Root layout with metadata
import { Inter } from 'next/font/google';
import { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Site Title',
    template: '%s | Site Title',
  },
  description: 'Site description',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### Server Actions
```typescript
// app/actions.ts
'use server';

export async function submitForm(formData: FormData) {
  const email = formData.get('email');
  // Server-side validation and processing
  // Direct database access possible
}

// Usage in component
<form action={submitForm}>
  <input name="email" type="email" required />
  <button type="submit">Submit</button>
</form>
```

### Route Handlers
```typescript
// app/api/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json();

  return NextResponse.json({ success: true });
}
```

### Component Patterns with shadcn/ui
```tsx
// Composable component pattern
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ModalExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Modal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modal Title</DialogTitle>
          <DialogDescription>
            Modal description goes here.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
```

### Environment Variables
```typescript
// .env.local
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_API_URL="https://api.example.com"

// Usage
const dbUrl = process.env.DATABASE_URL; // Server only
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Client & Server
```

### Build Optimization
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['example.com'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
```

## Review Checklist

### Pre-Commit
- [ ] TypeScript compiles without errors
- [ ] No ESLint warnings
- [ ] Tests pass
- [ ] Code formatted with Prettier
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] Dependencies up to date
- [ ] Tailwind classes organized
- [ ] Components follow shadcn/ui patterns
- [ ] Images optimized with Next/Image

### Code Review
- [ ] Logic is clear and correct
- [ ] Error cases handled
- [ ] Performance considered
- [ ] Security implications reviewed
- [ ] Accessibility maintained
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] Server/Client components properly separated
- [ ] Metadata and SEO configured
- [ ] Core Web Vitals targets met