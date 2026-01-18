# Component Library

## Overview

This document defines the complete component library specifications for modern web applications built with Next.js 15, Tailwind CSS, and shadcn/ui. All components follow atomic design principles and are optimized for performance, accessibility, and developer experience.

## Core Components

### Container Component

A responsive container that provides consistent spacing and max-width constraints across the application.

```tsx
// components/common/Container.tsx
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface ContainerProps {
  children: ReactNode
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}

export const Container = ({
  children,
  className,
  size = "lg"
}: ContainerProps) => (
  <div
    className={cn(
      "mx-auto px-4 sm:px-6 lg:px-8",
      {
        "max-w-3xl": size === "sm",   // 768px - Centered content
        "max-w-5xl": size === "md",   // 1024px - Standard content
        "max-w-7xl": size === "lg",   // 1280px - Wide content
        "max-w-[2000px]": size === "xl" // Full width with max limit
      },
      className
    )}
  >
    {children}
  </div>
)
```

#### Container Usage Guidelines
- Use `sm` for centered text content (articles, blog posts)
- Use `md` for standard forms and medium-width layouts
- Use `lg` for main application content (default)
- Use `xl` for full-width dashboards or galleries

### Button Component

A versatile button component with multiple variants and sizes, built with class-variance-authority (cva).

```tsx
// components/common/Button.tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ButtonHTMLAttributes, forwardRef } from "react"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500",
        outline: "border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500",
        secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500",
        ghost: "text-primary-600 hover:bg-primary-50",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
        success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
      },
      size: {
        xs: "px-2.5 py-1.5 text-xs",
        sm: "px-3 py-2 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
        xl: "px-8 py-4 text-xl"
      },
      fullWidth: {
        true: "w-full"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false
    }
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <LoadingSpinner className="mr-2" />}
        {icon && !loading && <span className="mr-2">{icon}</span>}
        {children}
      </button>
    )
  }
)

export { Button, buttonVariants }
```

#### Button Usage Guidelines
- **Primary**: Main actions (Submit, Save, Continue)
- **Outline**: Secondary actions (Cancel, Back)
- **Ghost**: Tertiary actions (Learn More, View Details)
- **Danger**: Destructive actions (Delete, Remove)
- **Success**: Confirmation actions (Approve, Complete)

### Card Component

A flexible card component for content grouping with optional hover effects.

```tsx
// components/common/Card.tsx
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  bordered?: boolean
  padding?: "none" | "sm" | "md" | "lg"
  onClick?: () => void
}

export const Card = ({
  children,
  className,
  hover = false,
  bordered = false,
  padding = "md",
  onClick
}: CardProps) => (
  <div
    className={cn(
      "rounded-xl bg-white shadow-sm",
      {
        "transition-all duration-200 hover:shadow-md hover:scale-105 cursor-pointer": hover,
        "border border-gray-200": bordered,
        "p-0": padding === "none",
        "p-4": padding === "sm",
        "p-6": padding === "md",
        "p-8": padding === "lg"
      },
      className
    )}
    onClick={onClick}
  >
    {children}
  </div>
)

// Card subcomponents for composition
export const CardHeader = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("border-b border-gray-200 pb-4 mb-4", className)}>
    {children}
  </div>
)

export const CardTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cn("text-xl font-semibold text-gray-900", className)}>
    {children}
  </h3>
)

export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("text-gray-600", className)}>
    {children}
  </div>
)

export const CardFooter = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("border-t border-gray-200 pt-4 mt-4", className)}>
    {children}
  </div>
)
```

## Layout Components

### Header Component

A responsive header with navigation, mobile menu, and scroll effects.

```tsx
// components/layout/Header.tsx
"use client"

import { useState, useEffect } from "react"
import { Container } from "@/components/common/Container"
import { Button } from "@/components/common/Button"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface NavigationItem {
  name: string
  href: string
  external?: boolean
}

interface HeaderProps {
  navigation?: NavigationItem[]
  logo?: React.ReactNode
  actions?: React.ReactNode
}

export const Header = ({
  navigation = [],
  logo = <span className="text-2xl font-bold">Logo</span>,
  actions
}: HeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-200",
        isScrolled
          ? "border-b border-gray-200/70 bg-white shadow-sm backdrop-blur-sm"
          : "bg-white/90 backdrop-blur-sm"
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-primary-900">
            {logo}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="font-medium text-primary-900 transition-colors duration-200 hover:text-primary-600"
              >
                {item.name}
              </Link>
            ))}
            {actions}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="font-medium text-primary-900 hover:text-primary-600"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-2">{actions}</div>
            </div>
          </div>
        )}
      </Container>
    </header>
  )
}
```

### Footer Component

A comprehensive footer with multiple sections and responsive layout.

```tsx
// components/layout/Footer.tsx
import { Container } from "@/components/common/Container"
import Link from "next/link"

interface FooterSection {
  title: string
  links: Array<{
    name: string
    href: string
  }>
}

interface FooterProps {
  sections?: FooterSection[]
  copyright?: string
  social?: React.ReactNode
}

export const Footer = ({
  sections = [],
  copyright,
  social
}: FooterProps) => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <Container>
        <div className="py-12">
          {sections.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="font-semibold text-gray-900 mb-4">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="text-sm text-gray-600 hover:text-gray-900"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-center border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-500">
              {copyright || `© ${currentYear} All rights reserved.`}
            </p>
            {social && <div className="mt-4 md:mt-0">{social}</div>}
          </div>
        </div>
      </Container>
    </footer>
  )
}
```

## Section Components

### Hero Section

A full-screen hero section with background image and overlay.

```tsx
// components/sections/Hero.tsx
import { Container } from "@/components/common/Container"
import { Button } from "@/components/common/Button"
import Image from "next/image"

interface HeroProps {
  title: string | React.ReactNode
  subtitle?: string | React.ReactNode
  primaryCTA?: {
    text: string
    href?: string
    onClick?: () => void
  }
  secondaryCTA?: {
    text: string
    href?: string
    onClick?: () => void
  }
  backgroundImage?: string
  overlay?: boolean
  height?: "screen" | "lg" | "md"
  centered?: boolean
}

export const Hero = ({
  title,
  subtitle,
  primaryCTA,
  secondaryCTA,
  backgroundImage,
  overlay = true,
  height = "screen",
  centered = true
}: HeroProps) => {
  const heightClasses = {
    screen: "h-screen",
    lg: "h-[600px]",
    md: "h-[400px]"
  }

  return (
    <section className={cn("relative overflow-hidden", heightClasses[height])}>
      {/* Background Image */}
      {backgroundImage && (
        <div className="absolute inset-0">
          <Image
            src={backgroundImage}
            alt=""
            fill
            className="object-cover"
            priority
          />
          {overlay && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-900/95 via-primary-900/90 to-primary-800/95" />
          )}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        <div className="h-20 flex-shrink-0" /> {/* Navigation spacer */}

        <div className={cn(
          "flex flex-1",
          centered ? "items-center justify-center" : "items-start pt-20"
        )}>
          <Container size="lg">
            <div className={centered ? "text-center" : ""}>
              {typeof title === "string" ? (
                <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                  {title}
                </h1>
              ) : (
                title
              )}

              {subtitle && (
                typeof subtitle === "string" ? (
                  <p className="mx-auto mb-8 max-w-3xl text-xl leading-relaxed text-gray-100 lg:text-2xl">
                    {subtitle}
                  </p>
                ) : (
                  subtitle
                )
              )}

              {(primaryCTA || secondaryCTA) && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {primaryCTA && (
                    <Button
                      size="lg"
                      onClick={primaryCTA.onClick}
                      className="w-full sm:w-auto"
                    >
                      {primaryCTA.text}
                    </Button>
                  )}
                  {secondaryCTA && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={secondaryCTA.onClick}
                      className="w-full sm:w-auto border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                    >
                      {secondaryCTA.text}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Container>
        </div>
      </div>
    </section>
  )
}
```

### Logo Wall

A responsive logo grid for displaying client or partner logos.

```tsx
// components/sections/LogoWall.tsx
import { Container } from "@/components/common/Container"
import Image from "next/image"

interface Logo {
  name: string
  src: string
  alt: string
  url?: string
}

interface LogoWallProps {
  title?: string
  subtitle?: string
  logos: Logo[]
  variant?: "default" | "grayscale" | "carousel"
  columns?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
}

export const LogoWall = ({
  title,
  subtitle,
  logos,
  variant = "grayscale",
  columns = { mobile: 2, tablet: 4, desktop: 6 }
}: LogoWallProps) => {
  const gridClasses = cn(
    "grid gap-8 items-center justify-items-center",
    `grid-cols-${columns.mobile}`,
    `md:grid-cols-${columns.tablet}`,
    `lg:grid-cols-${columns.desktop}`
  )

  return (
    <section className="py-20 bg-gray-50">
      <Container>
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>}
            {subtitle && <p className="text-lg text-gray-600">{subtitle}</p>}
          </div>
        )}

        {variant === "carousel" ? (
          <div className="overflow-hidden">
            <div className="flex animate-infinite-scroll">
              {[...logos, ...logos].map((logo, index) => (
                <LogoItem key={`${logo.name}-${index}`} logo={logo} variant={variant} />
              ))}
            </div>
          </div>
        ) : (
          <div className={gridClasses}>
            {logos.map((logo) => (
              <LogoItem key={logo.name} logo={logo} variant={variant} />
            ))}
          </div>
        )}
      </Container>
    </section>
  )
}

const LogoItem = ({ logo, variant }: { logo: Logo; variant: string }) => {
  const imageClasses = cn(
    "max-h-12 w-auto object-contain transition-all duration-200",
    variant === "grayscale" && "filter grayscale hover:grayscale-0 opacity-60 hover:opacity-100"
  )

  const content = (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={120}
      height={60}
      className={imageClasses}
    />
  )

  if (logo.url) {
    return (
      <a
        href={logo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center h-16 w-full"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="flex items-center justify-center h-16 w-full">
      {content}
    </div>
  )
}
```

### Feature Grid

A versatile grid for displaying features with icons.

```tsx
// components/sections/FeatureGrid.tsx
import { Container } from "@/components/common/Container"
import { Card, CardContent } from "@/components/common/Card"
import { LucideIcon } from "lucide-react"

interface Feature {
  icon: LucideIcon | React.ReactNode
  title: string
  description: string
  link?: {
    text: string
    href: string
  }
}

interface FeatureGridProps {
  title?: string
  subtitle?: string
  features: Feature[]
  columns?: 2 | 3 | 4
  iconStyle?: "default" | "filled" | "outlined"
}

export const FeatureGrid = ({
  title,
  subtitle,
  features,
  columns = 3,
  iconStyle = "filled"
}: FeatureGridProps) => {
  const gridClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  }

  const iconContainerClasses = {
    default: "bg-gray-100 text-gray-600",
    filled: "bg-primary-100 text-primary-600",
    outlined: "border-2 border-primary-200 text-primary-600"
  }

  return (
    <section className="py-20 bg-white">
      <Container>
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>}
            {subtitle && <p className="text-lg text-gray-600 max-w-3xl mx-auto">{subtitle}</p>}
          </div>
        )}

        <div className={cn("grid gap-8", gridClasses[columns])}>
          {features.map((feature, index) => (
            <Card key={index} hover className="text-center">
              <CardContent className="p-6">
                <div className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-lg mx-auto",
                  iconContainerClasses[iconStyle]
                )}>
                  {React.isValidElement(feature.icon) ? (
                    feature.icon
                  ) : (
                    <feature.icon className="h-6 w-6" />
                  )}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed mb-4">
                  {feature.description}
                </p>
                {feature.link && (
                  <a
                    href={feature.link.href}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {feature.link.text} →
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  )
}
```

### Testimonial Section

Display customer testimonials in various layouts.

```tsx
// components/sections/TestimonialSection.tsx
import { Container } from "@/components/common/Container"
import { Card, CardContent } from "@/components/common/Card"
import Image from "next/image"
import { Quote } from "lucide-react"

interface Testimonial {
  quote: string
  author: string
  title?: string
  company?: string
  avatar?: string
  logo?: string
  rating?: number
}

interface TestimonialSectionProps {
  title?: string
  subtitle?: string
  testimonials: Testimonial[]
  variant?: "cards" | "carousel" | "featured"
  showQuoteIcon?: boolean
}

export const TestimonialSection = ({
  title,
  subtitle,
  testimonials,
  variant = "cards",
  showQuoteIcon = true
}: TestimonialSectionProps) => {
  return (
    <section className="py-20 bg-white">
      <Container>
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>}
            {subtitle && <p className="text-lg text-gray-600 max-w-3xl mx-auto">{subtitle}</p>}
          </div>
        )}

        {variant === "cards" && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard
                key={index}
                testimonial={testimonial}
                showQuoteIcon={showQuoteIcon}
              />
            ))}
          </div>
        )}

        {variant === "featured" && testimonials[0] && (
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 md:p-12">
              {showQuoteIcon && (
                <Quote className="h-10 w-10 text-primary-600 mb-6" />
              )}
              <blockquote className="text-2xl text-gray-900 leading-relaxed mb-8">
                "{testimonials[0].quote}"
              </blockquote>
              <TestimonialAuthor testimonial={testimonials[0]} />
            </Card>
          </div>
        )}
      </Container>
    </section>
  )
}

const TestimonialCard = ({
  testimonial,
  showQuoteIcon
}: {
  testimonial: Testimonial
  showQuoteIcon: boolean
}) => (
  <Card className="h-full">
    <CardContent className="p-6 flex flex-col h-full">
      {showQuoteIcon && (
        <Quote className="h-8 w-8 text-primary-600 mb-4" />
      )}
      <blockquote className="flex-1 mb-6">
        <p className="text-gray-700 leading-relaxed">
          "{testimonial.quote}"
        </p>
      </blockquote>
      <TestimonialAuthor testimonial={testimonial} />
    </CardContent>
  </Card>
)

const TestimonialAuthor = ({ testimonial }: { testimonial: Testimonial }) => (
  <div className="flex items-center gap-4">
    {testimonial.avatar && (
      <div className="h-12 w-12 flex-shrink-0">
        <Image
          src={testimonial.avatar}
          alt={testimonial.author}
          width={48}
          height={48}
          className="rounded-full object-cover"
        />
      </div>
    )}
    <div className="flex-1">
      <p className="font-semibold text-gray-900">
        {testimonial.author}
      </p>
      {testimonial.title && (
        <p className="text-sm text-gray-600">
          {testimonial.title}
          {testimonial.company && `, ${testimonial.company}`}
        </p>
      )}
    </div>
    {testimonial.logo && (
      <div className="h-8">
        <Image
          src={testimonial.logo}
          alt={testimonial.company || "Company logo"}
          width={80}
          height={32}
          className="h-full w-auto object-contain"
        />
      </div>
    )}
  </div>
)
```

## Form Components

### Input Field

A comprehensive input component with validation states.

```tsx
// components/forms/Input.tsx
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    hint,
    required,
    leftIcon,
    rightIcon,
    className,
    ...props
  }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            className={cn(
              "w-full border rounded-lg px-4 py-2",
              "text-base leading-normal",
              "transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
              {
                "pl-10": leftIcon,
                "pr-10": rightIcon,
                "border-gray-300": !error,
                "border-red-500 focus:ring-red-500": error,
                "bg-gray-100 cursor-not-allowed": props.disabled
              },
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {hint && !error && (
          <p className="mt-1 text-sm text-gray-500">{hint}</p>
        )}

        {error && (
          <p id={`${props.id}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }
)

export { Input }
```

## Utility Components

### Loading States

```tsx
// components/common/Loading.tsx
export const LoadingSpinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  }

  return (
    <div className="flex items-center justify-center">
      <div className={cn(
        "animate-spin rounded-full border-2 border-primary-600 border-t-transparent",
        sizeClasses[size]
      )} />
    </div>
  )
}

export const SkeletonLoader = ({ lines = 2 }: { lines?: number }) => (
  <div className="animate-pulse">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={cn(
          "h-4 bg-gray-200 rounded mb-2",
          i === lines - 1 ? "w-1/2" : "w-full"
        )}
      />
    ))}
  </div>
)
```

### Empty States

```tsx
// components/common/EmptyState.tsx
import { Button } from "@/components/common/Button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    text: string
    onClick: () => void
  }
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {icon && (
      <div className="mb-4 text-gray-400">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    {description && (
      <p className="text-gray-600 mb-6 max-w-sm">{description}</p>
    )}
    {action && (
      <Button onClick={action.onClick}>
        {action.text}
      </Button>
    )}
  </div>
)
```

## Component Guidelines

### Accessibility Requirements
- All interactive components must be keyboard accessible
- Include proper ARIA labels and roles
- Maintain 4.5:1 color contrast ratio minimum
- Provide focus indicators for all interactive elements
- Support screen reader announcements

### Performance Considerations
- Use dynamic imports for heavy components
- Implement lazy loading for below-fold content
- Optimize images with Next/Image component
- Minimize bundle size with tree-shaking
- Use CSS-in-JS sparingly

### Responsive Behavior
- Mobile-first development approach
- Touch targets minimum 44x44px on mobile
- Fluid typography scaling
- Flexible grid layouts
- Progressive enhancement

### Testing Requirements
- Unit tests for all logic
- Visual regression tests for components
- Accessibility audits with axe-core
- Cross-browser compatibility testing
- Performance benchmarking

## Integration with shadcn/ui

This component library is designed to work seamlessly with shadcn/ui components. When using both:

1. **Prefer shadcn/ui base components** for form elements (Input, Select, Checkbox, etc.)
2. **Use our custom components** for layout and sections (Hero, LogoWall, etc.)
3. **Extend shadcn/ui components** with our variants when needed
4. **Maintain consistent theming** across both libraries

## Usage Examples

### Complete Page Example

```tsx
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Hero } from "@/components/sections/Hero"
import { FeatureGrid } from "@/components/sections/FeatureGrid"
import { TestimonialSection } from "@/components/sections/TestimonialSection"
import { Zap, Shield, Rocket } from "lucide-react"

export default function HomePage() {
  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Optimized for speed and performance"
    },
    {
      icon: Shield,
      title: "Secure by Default",
      description: "Built with security best practices"
    },
    {
      icon: Rocket,
      title: "Ready to Scale",
      description: "Grows with your business needs"
    }
  ]

  const testimonials = [
    {
      quote: "This product changed how we work",
      author: "Jane Doe",
      title: "CEO",
      company: "Acme Corp"
    }
  ]

  return (
    <>
      <Header />
      <main>
        <Hero
          title="Build Better Products"
          subtitle="The modern platform for ambitious teams"
          primaryCTA={{ text: "Get Started" }}
          secondaryCTA={{ text: "Learn More" }}
        />
        <FeatureGrid
          title="Why Choose Us"
          features={features}
        />
        <TestimonialSection
          title="Trusted by Teams"
          testimonials={testimonials}
        />
      </main>
      <Footer />
    </>
  )
}
```

## Version History

- **v1.0.0** - Initial component library with core components
- **v1.1.0** - Added section components and form elements
- **v1.2.0** - Enhanced accessibility and performance optimizations
- **v1.3.0** - Integration with shadcn/ui and Tailwind CSS