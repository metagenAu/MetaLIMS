'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Search,
  Bell,
  User,
  LogOut,
  Settings,
  Moon,
  Sun,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

export function Header() {
  const { data: session } = useSession();
  const [darkMode, setDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const initials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:px-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search samples, orders, clients..."
            className="flex h-9 w-full rounded-md border border-input bg-background px-9 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          />
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-card p-2 shadow-lg z-50">
              <p className="text-xs text-muted-foreground px-2 py-1">
                Type to search across samples, orders, clients, and more...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleDarkMode}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {darkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Notifications */}
        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
          </span>
        </button>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
              <Avatar.Root className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Avatar.Fallback className="text-xs font-medium text-primary">
                  {initials}
                </Avatar.Fallback>
              </Avatar.Root>
              {session?.user?.name && (
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-none">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.user.role || 'Staff'}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-[180px] rounded-md border bg-card p-1 shadow-lg"
            >
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-muted">
                <User className="h-4 w-4" />
                Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-muted">
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-muted"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
