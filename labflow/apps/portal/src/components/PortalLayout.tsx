'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  TestTubes,
  FileText,
  Receipt,
  UserCog,
  HelpCircle,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalHeader from './PortalHeader';
import { usePortalAuth } from '@/hooks/usePortalAuth';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Orders', href: '/orders', icon: ClipboardList },
  { label: 'Samples', href: '/samples', icon: TestTubes },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Invoices', href: '/invoices', icon: Receipt },
  { label: 'Account', href: '/account/profile', icon: UserCog },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = usePortalAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-white transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4 lg:hidden">
          <span className="text-lg font-semibold text-foreground">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-4">
          <div className="rounded-lg bg-primary/5 p-3">
            <p className="text-xs font-medium text-primary">Need help?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Contact our support team for assistance.
            </p>
            <Link
              href="/support"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              Get Support
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalHeader onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
