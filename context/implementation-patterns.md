# Implementation Patterns

## Overview

This document provides comprehensive implementation patterns for modern web applications using Next.js 15, Tailwind CSS, shadcn/ui, and related technologies. These patterns ensure consistency, performance, and maintainability across the codebase.

## Next.js 15 App Router Patterns

### Project Structure

```
app/
├── (routes)/              # Route groups for organization
│   ├── (marketing)/       # Public pages
│   │   ├── page.tsx      # Home page
│   │   ├── about/
│   │   └── pricing/
│   ├── (app)/            # Protected app pages
│   │   ├── dashboard/
│   │   └── settings/
│   └── (auth)/           # Auth pages
│       ├── login/
│       └── register/
├── api/                   # API routes
│   ├── auth/
│   └── data/
├── components/            # Shared components
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   ├── sections/         # Page sections
│   └── common/           # Common reusable components
├── lib/                  # Utility functions
│   ├── utils.ts          # Helper functions
│   ├── constants.ts      # App constants
│   └── db.ts            # Database utilities
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
├── styles/               # Global styles
│   └── globals.css
├── public/               # Static assets
│   ├── images/           # Optimized images
│   ├── fonts/           # Local fonts (if any)
│   └── documents/        # PDFs, etc.
└── middleware.ts         # Edge middleware
```

### Root Layout Pattern

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: {
    default: 'Site Name',
    template: '%s | Site Name'
  },
  description: 'Site description',
  metadataBase: new URL('https://example.com'),
  openGraph: {
    title: 'Site Name',
    description: 'Site description',
    url: 'https://example.com',
    siteName: 'Site Name',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  twitter: {
    title: 'Site Name',
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn(inter.variable)} suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.className
      )}>
        {children}
      </body>
    </html>
  )
}
```

### Page Patterns

#### Server Component (Default)

```tsx
// app/page.tsx - Server Component by default
import { Suspense } from 'react'
import { getServerData } from '@/lib/data'
import { LoadingSpinner } from '@/components/common/Loading'

// Async data fetching directly in component
export default async function Page() {
  const data = await getServerData()

  return (
    <main>
      <Suspense fallback={<LoadingSpinner />}>
        {/* Content that depends on data */}
        <DataContent data={data} />
      </Suspense>
    </main>
  )
}

// Metadata can be dynamic
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getServerData(params.id)

  return {
    title: data.title,
    description: data.description,
  }
}
```

#### Client Component Pattern

```tsx
// app/interactive/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InteractivePage() {
  const router = useRouter()
  const [state, setState] = useState<string>('')

  useEffect(() => {
    // Client-side effect
  }, [])

  return (
    <div>
      {/* Interactive content */}
      <button onClick={() => router.push('/next')}>
        Navigate
      </button>
    </div>
  )
}
```

### Server Actions

```typescript
// app/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const FormSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10),
})

export async function submitForm(prevState: any, formData: FormData) {
  const validatedFields = FormSchema.safeParse({
    email: formData.get('email'),
    message: formData.get('message'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Submit Form.',
    }
  }

  try {
    // Process the form data
    await saveToDatabase(validatedFields.data)

    // Revalidate the cache
    revalidatePath('/submissions')

    // Redirect on success
    redirect('/thank-you')
  } catch (error) {
    return {
      message: 'Database Error: Failed to Submit Form.',
    }
  }
}
```

### API Route Patterns

```typescript
// app/api/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const result = QuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  })

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    )
  }

  const data = await fetchData(result.data)

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await createData(body)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
```

### Middleware Pattern

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check authentication
  const token = request.cookies.get('token')

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Add security headers
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## Tailwind CSS Configuration

### Complete Configuration

```javascript
// tailwind.config.ts
import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: '#f0f3f9',
          100: '#dce3f1',
          200: '#bbc9e4',
          300: '#92a7d1',
          400: '#6a83bc',
          500: '#4e67a7',
          600: '#1a2f6c',
          700: '#162555',
          800: '#121e45',
          900: '#0f1937',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'infinite-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'infinite-scroll': 'infinite-scroll 20s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

### Global Styles

```css
/* app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700;900&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221 83% 53%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221 83% 53%;
    --radius: 0.5rem;
    --font-inter: 'Inter', sans-serif;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer utilities {
  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
}
```

### Utility Classes Pattern

```tsx
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage in components
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  isDisabled && "disabled-classes",
  className // Allow override from props
)} />
```

## shadcn/ui Integration

### Installation and Setup

```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init

# Install components as needed
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add toast
```

### Component Extension Pattern

```tsx
// Extending shadcn/ui Button
import { Button as ShadcnButton } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ComponentProps<typeof ShadcnButton> {
  loading?: boolean
  loadingText?: string
}

export function Button({
  loading,
  loadingText = 'Loading...',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </ShadcnButton>
  )
}
```

### Form Pattern with Zod

```tsx
// Form with validation
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export function LoginForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Submit to server action or API
      const result = await loginUser(values)

      toast({
        title: 'Success',
        description: 'You have been logged in.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid credentials.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="email@example.com" {...field} />
              </FormControl>
              <FormDescription>
                Enter your email address
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" loading={form.formState.isSubmitting}>
          Submit
        </Button>
      </form>
    </Form>
  )
}
```

## Performance Optimization Patterns

### Image Optimization

```tsx
// Using Next/Image with proper optimization
import Image from 'next/image'

export function OptimizedImage() {
  return (
    <Image
      src="/hero-image.jpg"
      alt="Description"
      width={1920}
      height={1080}
      priority // For LCP images
      placeholder="blur"
      blurDataURL={shimmerBlurDataURL}
      sizes="(max-width: 640px) 100vw,
             (max-width: 1024px) 75vw,
             50vw"
      className="object-cover"
    />
  )
}

// Shimmer placeholder generator
const shimmer = (w: number, h: number) => `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g">
        <stop stop-color="#f6f7f8" offset="0%" />
        <stop stop-color="#edeef1" offset="50%" />
        <stop stop-color="#f6f7f8" offset="100%" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)" />
  </svg>`

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str)

const shimmerBlurDataURL = `data:image/svg+xml;base64,${toBase64(shimmer(1920, 1080))}`
```

### Dynamic Imports

```tsx
// Code splitting with dynamic imports
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Heavy component loaded only when needed
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Disable SSR for client-only components
})

// With suspense
const LazyComponent = dynamic(() => import('@/components/LazyComponent'))

export function Page() {
  return (
    <div>
      <HeavyChart />

      <Suspense fallback={<Loading />}>
        <LazyComponent />
      </Suspense>
    </div>
  )
}
```

### Font Optimization

```tsx
// app/layout.tsx - Optimized font loading
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
})

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

### Data Fetching Patterns

```tsx
// Parallel data fetching
async function Page() {
  // Fetch in parallel
  const [userData, postsData, commentsData] = await Promise.all([
    getUser(),
    getPosts(),
    getComments(),
  ])

  return (
    <div>
      <UserProfile data={userData} />
      <PostList posts={postsData} />
      <CommentSection comments={commentsData} />
    </div>
  )
}

// With streaming
import { Suspense } from 'react'

async function SlowComponent() {
  const data = await slowDataFetch()
  return <div>{data}</div>
}

export default function Page() {
  return (
    <div>
      <FastComponent />
      <Suspense fallback={<Loading />}>
        <SlowComponent />
      </Suspense>
    </div>
  )
}
```

## Testing Patterns

### Component Testing

```tsx
// __tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<Button loading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

### E2E Testing with Playwright

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should log in successfully', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should show validation errors', async ({ page }) => {
    await page.goto('/login')

    await page.click('button[type="submit"]')

    await expect(page.locator('text=Invalid email')).toBeVisible()
    await expect(page.locator('text=Password required')).toBeVisible()
  })
})
```

## Security Patterns

### Input Validation

```typescript
// Always validate and sanitize input
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

const UserInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  bio: z.string().max(500).transform(val => DOMPurify.sanitize(val)),
})

export async function processUserInput(input: unknown) {
  const result = UserInputSchema.safeParse(input)

  if (!result.success) {
    throw new Error('Invalid input')
  }

  return result.data
}
```

### Environment Variables

```typescript
// lib/env.ts - Type-safe environment variables
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  SECRET_KEY: z.string().min(32),
})

export const env = envSchema.parse(process.env)

// Usage
import { env } from '@/lib/env'
const apiUrl = env.NEXT_PUBLIC_API_URL
```

### Authentication Pattern

```typescript
// lib/auth.ts
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function createToken(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)

  cookies().set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function verifyToken() {
  const token = cookies().get('token')?.value

  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.userId as string
  } catch {
    return null
  }
}
```

## Error Handling Patterns

### Error Boundaries

```tsx
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg"
      >
        Try again
      </button>
    </div>
  )
}

// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-2xl font-bold mb-4">Global Error</h2>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
```

### Not Found Pages

```tsx
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-4xl font-bold mb-4">404 - Not Found</h2>
      <p className="text-gray-600 mb-8">Could not find requested resource</p>
      <Link
        href="/"
        className="px-4 py-2 bg-primary-600 text-white rounded-lg"
      >
        Return Home
      </Link>
    </div>
  )
}
```

## Deployment Configuration

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['example.com'],
    formats: ['image/avif', 'image/webp'],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ],
  experimental: {
    optimizeCss: true,
  },
}

module.exports = nextConfig
```

## Best Practices Summary

1. **Always use Server Components by default** - Only use Client Components when necessary
2. **Implement proper error boundaries** - Handle errors gracefully at every level
3. **Optimize images and fonts** - Use Next.js built-in optimization features
4. **Validate all user input** - Use Zod for runtime type checking
5. **Implement proper caching strategies** - Use revalidate and cache headers
6. **Follow accessibility guidelines** - Ensure WCAG 2.1 AA+ compliance
7. **Use TypeScript strictly** - Enable all strict checks
8. **Implement comprehensive testing** - Unit, integration, and E2E tests
9. **Monitor performance metrics** - Track Core Web Vitals
10. **Document patterns consistently** - Maintain clear documentation