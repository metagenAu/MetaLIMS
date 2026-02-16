'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  ClipboardList,
  Microscope,
  FileText,
  Users,
  CreditCard,
  Warehouse,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Beaker,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Samples',
    href: '/samples',
    icon: FlaskConical,
    children: [
      { label: 'All Samples', href: '/samples' },
      { label: 'Register New', href: '/samples/new' },
      { label: 'Receive Samples', href: '/samples/receive' },
    ],
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: ClipboardList,
    children: [
      { label: 'All Orders', href: '/orders' },
      { label: 'Create Order', href: '/orders/new' },
    ],
  },
  {
    label: 'Testing',
    href: '/testing/worklists',
    icon: Microscope,
    children: [
      { label: 'Worklists', href: '/testing/worklists' },
      { label: 'Result Entry', href: '/testing/results' },
      { label: 'Review Queue', href: '/testing/review' },
    ],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileText,
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Users,
    children: [
      { label: 'All Clients', href: '/clients' },
      { label: 'Add Client', href: '/clients/new' },
    ],
  },
  {
    label: 'Billing',
    href: '/billing/invoices',
    icon: CreditCard,
    children: [
      { label: 'Invoices', href: '/billing/invoices' },
      { label: 'Payments', href: '/billing/payments' },
      { label: 'Price Lists', href: '/billing/price-lists' },
      { label: 'AR Aging', href: '/billing/aging' },
    ],
  },
  {
    label: 'Inventory',
    href: '/inventory/storage',
    icon: Warehouse,
    children: [
      { label: 'Storage', href: '/inventory/storage' },
      { label: 'Instruments', href: '/inventory/instruments' },
    ],
  },
  {
    label: 'Admin',
    href: '/admin/users',
    icon: Shield,
    children: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Roles', href: '/admin/roles' },
      { label: 'Test Methods', href: '/admin/test-methods' },
      { label: 'Specifications', href: '/admin/specifications' },
      { label: 'Audit Log', href: '/admin/audit-log' },
    ],
  },
  {
    label: 'Settings',
    href: '/settings/lab',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const toggleExpand = (label: string) => {
    const next = new Set(expandedItems);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    setExpandedItems(next);
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Beaker className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold text-primary">LabFlow</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const expanded = expandedItems.has(item.label);

          return (
            <div key={item.label}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => {
                  if (hasChildren && !collapsed) {
                    toggleExpand(item.label);
                  }
                }}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 flex-1"
                  onClick={(e) => {
                    if (hasChildren && !collapsed) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
                {hasChildren && !collapsed && (
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      expanded && 'rotate-180'
                    )}
                  />
                )}
              </div>

              {hasChildren && expanded && !collapsed && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l pl-3">
                  {item.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'block rounded-md px-3 py-1.5 text-sm transition-colors',
                        pathname === child.href
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse button */}
      <div className="border-t p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
