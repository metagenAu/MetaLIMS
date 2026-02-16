import { prisma } from '@labflow/db';
import type {
  SampleStatus,
  OrderStatus,
  TestStatus,
  UserRole,
} from '@labflow/db';
import {
  SAMPLE_STATUS_TRANSITIONS,
  TEST_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS,
  INVOICE_STATUS_TRANSITIONS,
} from '@labflow/shared';
import { ConflictError, ValidationError } from '../utils/errors';

// ============================================================
// Entity type union used throughout the workflow engine
// ============================================================

export type EntityType = 'SAMPLE' | 'TEST' | 'ORDER' | 'INVOICE';

// ============================================================
// Transition definitions
// ============================================================

/**
 * A single transition rule in the state machine.
 * `requiredRoles` restricts which user roles may trigger the transition.
 * When `requiredRoles` is undefined every authenticated user is allowed.
 */
interface TransitionRule {
  from: string;
  to: string;
  requiredRoles?: UserRole[];
}

/**
 * Role restrictions for specific transitions. These are layered on top of
 * the shared transition maps (which are the single source of truth for
 * which transitions are structurally allowed).
 */
interface RoleRestriction {
  entityType: EntityType;
  to: string;
  requiredRoles: UserRole[];
}

const ROLE_RESTRICTIONS: RoleRestriction[] = [
  // Sample: approval requires senior staff
  { entityType: 'SAMPLE', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'] },

  // Test: approval and rejection require senior staff
  { entityType: 'TEST', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'] },
  { entityType: 'TEST', to: 'REVIEW_REJECTED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'] },

  // Order: approval requires management
  { entityType: 'ORDER', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER'] },

  // Invoice: approval requires management or billing admin
  { entityType: 'INVOICE', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'BILLING_ADMIN'] },
];

// ============================================================
// Build TransitionRule[] from the shared transition maps
// ============================================================

/**
 * Convert a Record<Status, Status[]> transition map into TransitionRule[],
 * layering any role restrictions that apply.
 */
function buildRules(
  entityType: EntityType,
  transitionMap: Record<string, string[]>,
): TransitionRule[] {
  const rules: TransitionRule[] = [];
  for (const [from, targets] of Object.entries(transitionMap)) {
    for (const to of targets) {
      const restriction = ROLE_RESTRICTIONS.find(
        (r) => r.entityType === entityType && r.to === to,
      );
      rules.push({
        from,
        to,
        ...(restriction ? { requiredRoles: restriction.requiredRoles } : {}),
      });
    }
  }
  return rules;
}

const TRANSITION_RULES: Record<EntityType, TransitionRule[]> = {
  SAMPLE: buildRules('SAMPLE', SAMPLE_STATUS_TRANSITIONS as unknown as Record<string, string[]>),
  TEST: buildRules('TEST', TEST_STATUS_TRANSITIONS as unknown as Record<string, string[]>),
  ORDER: buildRules('ORDER', ORDER_STATUS_TRANSITIONS as unknown as Record<string, string[]>),
  INVOICE: buildRules('INVOICE', INVOICE_STATUS_TRANSITIONS as unknown as Record<string, string[]>),
};

// ============================================================
// Registry lookup
// ============================================================

function getTransitions(entityType: EntityType): TransitionRule[] {
  const rules = TRANSITION_RULES[entityType];
  if (!rules) {
    throw new ValidationError(`Unknown entity type: ${entityType}`);
  }
  return rules;
}

// ============================================================
// Public API
// ============================================================

/**
 * Validates whether a status transition is allowed for the given entity type.
 *
 * @param entityType - The type of entity (SAMPLE, TEST, ORDER, INVOICE)
 * @param currentStatus - The entity's current status
 * @param targetStatus - The desired target status
 * @returns `true` when the transition is allowed
 * @throws {ConflictError} when the transition is not allowed
 */
export function validateTransition(
  entityType: EntityType,
  currentStatus: string,
  targetStatus: string,
): boolean {
  if (currentStatus === targetStatus) {
    throw new ConflictError(
      `${entityType} is already in status '${currentStatus}'`,
    );
  }

  const transitions = getTransitions(entityType);
  const allowed = transitions.some(
    (t) => t.from === currentStatus && t.to === targetStatus,
  );

  if (!allowed) {
    throw new ConflictError(
      `Cannot transition ${entityType} from '${currentStatus}' to '${targetStatus}'`,
      {
        entityType,
        currentStatus,
        targetStatus,
        allowedTargets: transitions
          .filter((t) => t.from === currentStatus)
          .map((t) => t.to),
      },
    );
  }

  return true;
}

/**
 * Executes a status transition by validating it, updating the entity in the
 * database, and recording an audit log entry -- all within a single
 * transaction.
 *
 * @param entityType - The type of entity (SAMPLE, TEST, ORDER, INVOICE)
 * @param entityId - The primary-key id of the entity
 * @param targetStatus - The desired target status
 * @param userId - The user performing the transition
 * @param metadata - Optional extra data to store in the audit log
 * @returns The updated entity record
 */
export async function executeTransition(
  entityType: EntityType,
  entityId: string,
  targetStatus: string,
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    // ----------------------------------------------------------
    // 1. Read current status (with a lock-worthy read inside the txn)
    // ----------------------------------------------------------
    let currentStatus: string;
    let organizationId: string;

    switch (entityType) {
      case 'SAMPLE': {
        const sample = await tx.sample.findUniqueOrThrow({
          where: { id: entityId },
          select: { status: true, organizationId: true },
        });
        currentStatus = sample.status;
        organizationId = sample.organizationId;
        break;
      }
      case 'TEST': {
        const test = await tx.test.findUniqueOrThrow({
          where: { id: entityId },
          select: { status: true, sample: { select: { organizationId: true } } },
        });
        currentStatus = test.status;
        organizationId = test.sample.organizationId;
        break;
      }
      case 'ORDER': {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: entityId },
          select: { status: true, organizationId: true },
        });
        currentStatus = order.status;
        organizationId = order.organizationId;
        break;
      }
      case 'INVOICE': {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: entityId },
          select: { status: true, organizationId: true },
        });
        currentStatus = invoice.status;
        organizationId = invoice.organizationId;
        break;
      }
      default:
        throw new ValidationError(`Unknown entity type: ${entityType}`);
    }

    // ----------------------------------------------------------
    // 2. Validate the transition
    // ----------------------------------------------------------
    validateTransition(entityType, currentStatus, targetStatus);

    // ----------------------------------------------------------
    // 3. Perform the update
    // ----------------------------------------------------------
    let updated: unknown;

    switch (entityType) {
      case 'SAMPLE':
        updated = await tx.sample.update({
          where: { id: entityId },
          data: { status: targetStatus as SampleStatus },
        });
        break;
      case 'TEST':
        updated = await tx.test.update({
          where: { id: entityId },
          data: { status: targetStatus as TestStatus },
        });
        break;
      case 'ORDER':
        updated = await tx.order.update({
          where: { id: entityId },
          data: { status: targetStatus as OrderStatus },
        });
        break;
      case 'INVOICE':
        updated = await tx.invoice.update({
          where: { id: entityId },
          data: { status: targetStatus as unknown as any },
        });
        break;
    }

    // ----------------------------------------------------------
    // 4. Write audit log
    // ----------------------------------------------------------
    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType,
        entityId,
        action: 'STATUS_TRANSITION',
        changes: {
          previousStatus: currentStatus,
          newStatus: targetStatus,
        },
        metadata: metadata ?? null,
      },
    });

    return updated;
  });
}

/**
 * Returns the list of statuses that the entity can transition to from its
 * current status, optionally filtered by the caller's role.
 *
 * @param entityType - The type of entity
 * @param currentStatus - The entity's current status
 * @param userRole - Optional role of the calling user for permission filtering
 * @returns An array of target status strings the user is allowed to trigger
 */
export function getAvailableTransitions(
  entityType: EntityType,
  currentStatus: string,
  userRole?: UserRole | string,
): string[] {
  const transitions = getTransitions(entityType);

  return transitions
    .filter((t) => {
      if (t.from !== currentStatus) return false;
      // If no role restriction is defined, anyone can trigger the transition
      if (!t.requiredRoles || t.requiredRoles.length === 0) return true;
      // If no role was provided, exclude role-restricted transitions
      if (!userRole) return false;
      return t.requiredRoles.includes(userRole as UserRole);
    })
    .map((t) => t.to);
}
