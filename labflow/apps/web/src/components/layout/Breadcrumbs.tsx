'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const labelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  samples: 'Samples',
  orders: 'Orders',
  testing: 'Testing',
  worklists: 'Worklists',
  results: 'Result Entry',
  review: 'Review Queue',
  reports: 'Reports',
  clients: 'Clients',
  billing: 'Billing',
  invoices: 'Invoices',
  payments: 'Payments',
  'price-lists': 'Price Lists',
  aging: 'AR Aging',
  inventory: 'Inventory',
  storage: 'Storage',
  instruments: 'Instruments',
  admin: 'Admin',
  users: 'Users',
  roles: 'Roles',
  'test-methods': 'Test Methods',
  specifications: 'Specifications',
  'audit-log': 'Audit Log',
  settings: 'Settings',
  lab: 'Lab Profile',
  new: 'New',
  receive: 'Receive',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    const isId =
      /^[0-9a-fA-F-]{8,}$/.test(segment) || /^\d+$/.test(segment);
    const label = isId
      ? `#${segment.slice(0, 8)}`
      : labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link
        href="/dashboard"
        className="hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {breadcrumbs.map((crumb, i) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="h-3.5 w-3.5" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
