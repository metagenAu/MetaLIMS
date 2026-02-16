import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

type Permission =
  | 'samples:read'
  | 'samples:write'
  | 'samples:delete'
  | 'orders:read'
  | 'orders:write'
  | 'orders:delete'
  | 'testing:read'
  | 'testing:write'
  | 'testing:approve'
  | 'reports:read'
  | 'reports:write'
  | 'reports:send'
  | 'clients:read'
  | 'clients:write'
  | 'clients:delete'
  | 'billing:read'
  | 'billing:write'
  | 'billing:delete'
  | 'inventory:read'
  | 'inventory:write'
  | 'admin:users'
  | 'admin:roles'
  | 'admin:settings'
  | 'admin:audit';

const rolePermissions: Record<string, Permission[]> = {
  admin: [
    'samples:read', 'samples:write', 'samples:delete',
    'orders:read', 'orders:write', 'orders:delete',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write', 'reports:send',
    'clients:read', 'clients:write', 'clients:delete',
    'billing:read', 'billing:write', 'billing:delete',
    'inventory:read', 'inventory:write',
    'admin:users', 'admin:roles', 'admin:settings', 'admin:audit',
  ],
  lab_manager: [
    'samples:read', 'samples:write',
    'orders:read', 'orders:write',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write', 'reports:send',
    'clients:read', 'clients:write',
    'billing:read', 'billing:write',
    'inventory:read', 'inventory:write',
    'admin:audit',
  ],
  analyst: [
    'samples:read',
    'orders:read',
    'testing:read', 'testing:write',
    'reports:read',
    'clients:read',
    'inventory:read',
  ],
  reviewer: [
    'samples:read',
    'orders:read',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write',
    'clients:read',
  ],
  receptionist: [
    'samples:read', 'samples:write',
    'orders:read', 'orders:write',
    'clients:read', 'clients:write',
    'billing:read',
  ],
  billing_clerk: [
    'clients:read',
    'orders:read',
    'billing:read', 'billing:write',
    'reports:read',
  ],
};

export function useRBAC() {
  const { data: session } = useSession();
  const role = session?.user?.role || '';

  const permissions = useMemo(() => {
    return new Set(rolePermissions[role] || []);
  }, [role]);

  const hasPermission = (permission: Permission): boolean => {
    return permissions.has(permission);
  };

  const hasAnyPermission = (...perms: Permission[]): boolean => {
    return perms.some((p) => permissions.has(p));
  };

  const hasAllPermissions = (...perms: Permission[]): boolean => {
    return perms.every((p) => permissions.has(p));
  };

  return {
    role,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin: role === 'admin',
    isLabManager: role === 'lab_manager',
    isAnalyst: role === 'analyst',
    isReviewer: role === 'reviewer',
  };
}
