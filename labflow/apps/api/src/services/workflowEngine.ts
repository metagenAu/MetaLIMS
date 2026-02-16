import { prisma } from '@labflow/db';
import type {
  SampleStatus,
  OrderStatus,
  TestStatus,
  UserRole,
} from '@labflow/db';
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
 * Sample status transitions.
 *
 * Happy path: REGISTERED -> RECEIVED -> IN_STORAGE -> IN_PROGRESS ->
 *             TESTING_COMPLETE -> APPROVED -> REPORTED
 *
 * Any status may transition to ON_HOLD or CANCELLED.
 */
const SAMPLE_TRANSITIONS: TransitionRule[] = [
  // Happy-path forward transitions
  { from: 'REGISTERED', to: 'RECEIVED' },
  { from: 'RECEIVED', to: 'IN_STORAGE' },
  { from: 'RECEIVED', to: 'IN_PROGRESS' },
  { from: 'IN_STORAGE', to: 'IN_PROGRESS' },
  { from: 'IN_PROGRESS', to: 'TESTING_COMPLETE' },
  { from: 'TESTING_COMPLETE', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'] },
  { from: 'APPROVED', to: 'REPORTED' },

  // Resume from hold
  { from: 'ON_HOLD', to: 'REGISTERED' },
  { from: 'ON_HOLD', to: 'RECEIVED' },
  { from: 'ON_HOLD', to: 'IN_STORAGE' },
  { from: 'ON_HOLD', to: 'IN_PROGRESS' },
  { from: 'ON_HOLD', to: 'TESTING_COMPLETE' },

  // Disposal
  { from: 'REPORTED', to: 'DISPOSED' },
  { from: 'IN_STORAGE', to: 'DISPOSED' },

  // Rejection
  { from: 'REGISTERED', to: 'REJECTED' },
  { from: 'RECEIVED', to: 'REJECTED' },
];

/**
 * Any-source transitions for Samples (ON_HOLD / CANCELLED).
 * These are generated dynamically in the lookup helpers.
 */
const SAMPLE_WILDCARD_TARGETS: string[] = ['ON_HOLD', 'CANCELLED'];

/**
 * All concrete sample statuses that may serve as the "current" status.
 */
const ALL_SAMPLE_STATUSES: string[] = [
  'REGISTERED',
  'RECEIVED',
  'IN_STORAGE',
  'IN_PROGRESS',
  'TESTING_COMPLETE',
  'APPROVED',
  'REPORTED',
  'ON_HOLD',
  'DISPOSED',
  'REJECTED',
  'CANCELLED',
];

/**
 * Test status transitions.
 *
 * Happy path: PENDING -> ASSIGNED -> IN_PROGRESS -> COMPLETED ->
 *             IN_REVIEW -> APPROVED
 *
 * Rejection loop: IN_REVIEW -> REVIEW_REJECTED -> IN_PROGRESS
 */
const TEST_TRANSITIONS: TransitionRule[] = [
  { from: 'PENDING', to: 'ASSIGNED' },
  { from: 'ASSIGNED', to: 'IN_PROGRESS' },
  { from: 'IN_PROGRESS', to: 'COMPLETED' },
  { from: 'COMPLETED', to: 'IN_REVIEW' },
  { from: 'IN_REVIEW', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'] },
  { from: 'IN_REVIEW', to: 'REVIEW_REJECTED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'SENIOR_ANALYST'] },
  { from: 'REVIEW_REJECTED', to: 'IN_PROGRESS' },

  // Hold / cancel from any active state
  { from: 'PENDING', to: 'ON_HOLD' },
  { from: 'ASSIGNED', to: 'ON_HOLD' },
  { from: 'IN_PROGRESS', to: 'ON_HOLD' },
  { from: 'COMPLETED', to: 'ON_HOLD' },
  { from: 'IN_REVIEW', to: 'ON_HOLD' },
  { from: 'REVIEW_REJECTED', to: 'ON_HOLD' },

  { from: 'PENDING', to: 'CANCELLED' },
  { from: 'ASSIGNED', to: 'CANCELLED' },
  { from: 'IN_PROGRESS', to: 'CANCELLED' },
  { from: 'ON_HOLD', to: 'CANCELLED' },

  // Resume from hold
  { from: 'ON_HOLD', to: 'PENDING' },
  { from: 'ON_HOLD', to: 'ASSIGNED' },
  { from: 'ON_HOLD', to: 'IN_PROGRESS' },
];

/**
 * Order status transitions.
 *
 * Happy path: DRAFT -> SUBMITTED -> RECEIVED -> IN_PROGRESS ->
 *             TESTING_COMPLETE -> IN_REVIEW -> APPROVED -> REPORTED -> COMPLETED
 */
const ORDER_TRANSITIONS: TransitionRule[] = [
  { from: 'DRAFT', to: 'SUBMITTED' },
  { from: 'SUBMITTED', to: 'RECEIVED' },
  { from: 'RECEIVED', to: 'IN_PROGRESS' },
  { from: 'IN_PROGRESS', to: 'TESTING_COMPLETE' },
  { from: 'TESTING_COMPLETE', to: 'IN_REVIEW' },
  { from: 'IN_REVIEW', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER'] },
  { from: 'APPROVED', to: 'REPORTED' },
  { from: 'REPORTED', to: 'COMPLETED' },

  // Hold / cancel wildcards
  { from: 'DRAFT', to: 'CANCELLED' },
  { from: 'SUBMITTED', to: 'CANCELLED' },
  { from: 'RECEIVED', to: 'CANCELLED' },
  { from: 'SUBMITTED', to: 'ON_HOLD' },
  { from: 'RECEIVED', to: 'ON_HOLD' },
  { from: 'IN_PROGRESS', to: 'ON_HOLD' },
  { from: 'TESTING_COMPLETE', to: 'ON_HOLD' },
  { from: 'IN_REVIEW', to: 'ON_HOLD' },

  // Resume from hold
  { from: 'ON_HOLD', to: 'SUBMITTED' },
  { from: 'ON_HOLD', to: 'RECEIVED' },
  { from: 'ON_HOLD', to: 'IN_PROGRESS' },
  { from: 'ON_HOLD', to: 'TESTING_COMPLETE' },
];

/**
 * Invoice status transitions.
 */
const INVOICE_TRANSITIONS: TransitionRule[] = [
  { from: 'DRAFT', to: 'PENDING_APPROVAL' },
  { from: 'PENDING_APPROVAL', to: 'APPROVED', requiredRoles: ['LAB_DIRECTOR', 'LAB_MANAGER', 'BILLING_ADMIN'] },
  { from: 'APPROVED', to: 'SENT' },
  { from: 'SENT', to: 'VIEWED' },
  { from: 'SENT', to: 'PARTIALLY_PAID' },
  { from: 'SENT', to: 'PAID' },
  { from: 'SENT', to: 'OVERDUE' },
  { from: 'VIEWED', to: 'PARTIALLY_PAID' },
  { from: 'VIEWED', to: 'PAID' },
  { from: 'VIEWED', to: 'OVERDUE' },
  { from: 'PARTIALLY_PAID', to: 'PAID' },
  { from: 'PARTIALLY_PAID', to: 'OVERDUE' },
  { from: 'OVERDUE', to: 'PARTIALLY_PAID' },
  { from: 'OVERDUE', to: 'PAID' },

  // Void from most statuses
  { from: 'DRAFT', to: 'VOID' },
  { from: 'PENDING_APPROVAL', to: 'VOID' },
  { from: 'APPROVED', to: 'VOID' },
  { from: 'SENT', to: 'VOID' },
  { from: 'VIEWED', to: 'VOID' },
  { from: 'OVERDUE', to: 'VOID' },

  // Write-off
  { from: 'OVERDUE', to: 'WRITTEN_OFF' },
];

// ============================================================
// Registry lookup
// ============================================================

function getTransitions(entityType: EntityType): TransitionRule[] {
  switch (entityType) {
    case 'SAMPLE':
      return SAMPLE_TRANSITIONS;
    case 'TEST':
      return TEST_TRANSITIONS;
    case 'ORDER':
      return ORDER_TRANSITIONS;
    case 'INVOICE':
      return INVOICE_TRANSITIONS;
    default:
      throw new ValidationError(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Build the complete transition list for samples, including wildcard
 * any-to-target rules that apply from every non-terminal status.
 */
function getEffectiveSampleTransitions(): TransitionRule[] {
  const explicit = [...SAMPLE_TRANSITIONS];
  const terminalStatuses = new Set(['DISPOSED', 'CANCELLED']);
  for (const status of ALL_SAMPLE_STATUSES) {
    if (terminalStatuses.has(status)) continue;
    for (const target of SAMPLE_WILDCARD_TARGETS) {
      // Skip if the source is already the target
      if (status === target) continue;
      // Only add if not already explicitly defined
      const exists = explicit.some((t) => t.from === status && t.to === target);
      if (!exists) {
        explicit.push({ from: status, to: target });
      }
    }
  }
  return explicit;
}

function getEffectiveTransitions(entityType: EntityType): TransitionRule[] {
  if (entityType === 'SAMPLE') {
    return getEffectiveSampleTransitions();
  }
  return getTransitions(entityType);
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

  const transitions = getEffectiveTransitions(entityType);
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
  const transitions = getEffectiveTransitions(entityType);

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
