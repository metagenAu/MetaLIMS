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

/**
 * Role-permission mapping using the canonical UserRole enum values
 * from the backend (Prisma schema and @labflow/shared).
 *
 * Valid roles: SUPER_ADMIN, LAB_DIRECTOR, LAB_MANAGER, SENIOR_ANALYST,
 * ANALYST, SAMPLE_RECEIVER, DATA_ENTRY, BILLING_ADMIN, BILLING_VIEWER,
 * CLIENT_ADMIN, CLIENT_USER, READONLY
 */
const rolePermissions: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'samples:read', 'samples:write', 'samples:delete',
    'orders:read', 'orders:write', 'orders:delete',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write', 'reports:send',
    'clients:read', 'clients:write', 'clients:delete',
    'billing:read', 'billing:write', 'billing:delete',
    'inventory:read', 'inventory:write',
    'admin:users', 'admin:roles', 'admin:settings', 'admin:audit',
  ],
  LAB_DIRECTOR: [
    'samples:read', 'samples:write', 'samples:delete',
    'orders:read', 'orders:write', 'orders:delete',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write', 'reports:send',
    'clients:read', 'clients:write', 'clients:delete',
    'billing:read', 'billing:write', 'billing:delete',
    'inventory:read', 'inventory:write',
    'admin:users', 'admin:roles', 'admin:settings', 'admin:audit',
  ],
  LAB_MANAGER: [
    'samples:read', 'samples:write',
    'orders:read', 'orders:write',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write', 'reports:send',
    'clients:read', 'clients:write',
    'billing:read', 'billing:write',
    'inventory:read', 'inventory:write',
    'admin:audit',
  ],
  SENIOR_ANALYST: [
    'samples:read',
    'orders:read',
    'testing:read', 'testing:write', 'testing:approve',
    'reports:read', 'reports:write',
    'clients:read',
    'inventory:read',
  ],
  ANALYST: [
    'samples:read',
    'orders:read',
    'testing:read', 'testing:write',
    'reports:read',
    'clients:read',
    'inventory:read',
  ],
  SAMPLE_RECEIVER: [
    'samples:read', 'samples:write',
    'orders:read', 'orders:write',
    'clients:read', 'clients:write',
    'billing:read',
  ],
  DATA_ENTRY: [
    'samples:read', 'samples:write',
    'orders:read', 'orders:write',
    'clients:read', 'clients:write',
  ],
  BILLING_ADMIN: [
    'clients:read',
    'orders:read',
    'billing:read', 'billing:write', 'billing:delete',
    'reports:read',
  ],
  BILLING_VIEWER: [
    'clients:read',
    'orders:read',
    'billing:read',
    'reports:read',
  ],
  CLIENT_ADMIN: [
    'orders:read', 'orders:write',
    'samples:read',
    'reports:read',
    'billing:read',
  ],
  CLIENT_USER: [
    'orders:read',
    'samples:read',
    'reports:read',
    'billing:read',
  ],
  READONLY: [
    'samples:read',
    'orders:read',
    'testing:read',
    'reports:read',
    'clients:read',
    'billing:read',
    'inventory:read',
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
    isAdmin: role === 'SUPER_ADMIN' || role === 'LAB_DIRECTOR',
    isLabManager: role === 'LAB_MANAGER',
    isAnalyst: role === 'ANALYST' || role === 'SENIOR_ANALYST',
    isReviewer: role === 'SENIOR_ANALYST' || role === 'LAB_MANAGER' || role === 'LAB_DIRECTOR',
  };
}
