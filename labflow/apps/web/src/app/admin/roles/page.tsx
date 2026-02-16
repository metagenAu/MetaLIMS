'use client';

import React, { useState } from 'react';
import { Shield, Check, X, Edit, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: Record<string, boolean>;
}

const permissionCategories = [
  { name: 'Samples', permissions: ['samples:read', 'samples:write', 'samples:delete'] },
  { name: 'Orders', permissions: ['orders:read', 'orders:write', 'orders:delete'] },
  { name: 'Testing', permissions: ['testing:read', 'testing:write', 'testing:approve'] },
  { name: 'Reports', permissions: ['reports:read', 'reports:write', 'reports:send'] },
  { name: 'Clients', permissions: ['clients:read', 'clients:write', 'clients:delete'] },
  { name: 'Billing', permissions: ['billing:read', 'billing:write', 'billing:delete'] },
  { name: 'Inventory', permissions: ['inventory:read', 'inventory:write'] },
  { name: 'Admin', permissions: ['admin:users', 'admin:roles', 'admin:settings', 'admin:audit'] },
];

const fallbackRoles: Role[] = [
  {
    id: '1', name: 'Admin', description: 'Full system access', userCount: 1,
    permissions: Object.fromEntries(permissionCategories.flatMap((c) => c.permissions.map((p) => [p, true]))),
  },
  {
    id: '2', name: 'Lab Manager', description: 'Lab operations management', userCount: 1,
    permissions: {
      'samples:read': true, 'samples:write': true, 'samples:delete': false,
      'orders:read': true, 'orders:write': true, 'orders:delete': false,
      'testing:read': true, 'testing:write': true, 'testing:approve': true,
      'reports:read': true, 'reports:write': true, 'reports:send': true,
      'clients:read': true, 'clients:write': true, 'clients:delete': false,
      'billing:read': true, 'billing:write': true, 'billing:delete': false,
      'inventory:read': true, 'inventory:write': true,
      'admin:users': false, 'admin:roles': false, 'admin:settings': false, 'admin:audit': true,
    },
  },
  {
    id: '3', name: 'Analyst', description: 'Testing and result entry', userCount: 2,
    permissions: {
      'samples:read': true, 'samples:write': false, 'samples:delete': false,
      'orders:read': true, 'orders:write': false, 'orders:delete': false,
      'testing:read': true, 'testing:write': true, 'testing:approve': false,
      'reports:read': true, 'reports:write': false, 'reports:send': false,
      'clients:read': true, 'clients:write': false, 'clients:delete': false,
      'billing:read': false, 'billing:write': false, 'billing:delete': false,
      'inventory:read': true, 'inventory:write': false,
      'admin:users': false, 'admin:roles': false, 'admin:settings': false, 'admin:audit': false,
    },
  },
  {
    id: '4', name: 'Reviewer', description: 'QA review and approval', userCount: 1,
    permissions: {
      'samples:read': true, 'samples:write': false, 'samples:delete': false,
      'orders:read': true, 'orders:write': false, 'orders:delete': false,
      'testing:read': true, 'testing:write': true, 'testing:approve': true,
      'reports:read': true, 'reports:write': true, 'reports:send': false,
      'clients:read': true, 'clients:write': false, 'clients:delete': false,
      'billing:read': false, 'billing:write': false, 'billing:delete': false,
      'inventory:read': false, 'inventory:write': false,
      'admin:users': false, 'admin:roles': false, 'admin:settings': false, 'admin:audit': false,
    },
  },
];

export default function RolesPage() {
  const [selectedRole, setSelectedRole] = useState<Role>(fallbackRoles[0]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-muted-foreground">Configure role-based access control</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Role
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Role list */}
          <div className="space-y-2">
            {fallbackRoles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  selectedRole.id === role.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted'
                )}
              >
                <Shield className={cn('h-5 w-5', selectedRole.id === role.id ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.userCount} users</p>
                </div>
              </button>
            ))}
          </div>

          {/* Permission matrix */}
          <div className="lg:col-span-3">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">{selectedRole.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedRole.description}</p>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Permission</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground w-20">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {permissionCategories.map((category) =>
                    category.permissions.map((perm, index) => (
                      <tr key={perm} className="hover:bg-muted/30">
                        {index === 0 && (
                          <td
                            className="px-4 py-2 font-medium align-top"
                            rowSpan={category.permissions.length}
                          >
                            {category.name}
                          </td>
                        )}
                        <td className="px-4 py-2 text-muted-foreground">
                          {perm.split(':')[1].replace(/^\w/, (c) => c.toUpperCase())}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {selectedRole.permissions[perm] ? (
                            <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
