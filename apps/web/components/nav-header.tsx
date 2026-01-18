"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Video, Upload, Film, Library, Menu, MessageSquare, Clapperboard, Settings, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Dashboard", icon: Video },
  { href: "/sources", label: "Sources", icon: Film },
  { href: "/clips", label: "Clips", icon: Library },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/assemble", label: "Assemble", icon: Clapperboard },
  { href: "/upload", label: "Upload", icon: Upload },
];

interface UserInfo {
  email: string;
  name: string;
  initials: string;
}

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        setUser({
          email: authUser.email || '',
          name,
          initials,
        });
      }
      setIsLoading(false);
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Mobile menu button - meets 44x44px touch target */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 h-11 w-11 p-0 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px]">
            <SheetTitle className="flex items-center gap-2 mb-6">
              <Video className="h-6 w-6" />
              <span className="font-bold">Video Clip Library</span>
            </SheetTitle>
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 h-12",
                        isActive && "bg-secondary"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
              <div className="border-t my-2" />
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                  <Settings className="h-5 w-5" />
                  <span>Settings</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                <span>Log out</span>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <div className="mr-4 flex">
          <Link
            href="/"
            className="mr-6 flex items-center space-x-2 min-h-[44px] px-2 -mx-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Video Clip Library - Home"
          >
            <Video className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">
              Video Clip Library
            </span>
          </Link>
        </div>

        {/* Desktop navigation - hidden on mobile */}
        <nav className="hidden md:flex items-center space-x-1 flex-1" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "gap-2 h-11 px-4",
                    isActive && "bg-secondary"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="ml-auto">
          {!isLoading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-10 rounded-full p-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="User menu"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {user.initials}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
