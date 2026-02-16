import { prisma } from '@labflow/db';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../utils/errors';
import { validateTransition } from './workflowEngine';

// ============================================================
// Constants
// ============================================================

/** Roles allowed to perform a review (level 1 approval). */
const REVIEWER_ROLES = new Set([
  'LAB_DIRECTOR',
  'LAB_MANAGER',
  'SENIOR_ANALYST',
]);

/** Roles allowed to perform a final approval (level 2 approval). */
const APPROVER_ROLES = new Set([
  'LAB_DIRECTOR',
  'LAB_MANAGER',
]);

// ============================================================
// Public API
// ============================================================

/**
 * Submits a completed test for peer review.
 * Transitions the test from COMPLETED to IN_REVIEW and records an
 * approval action.
 *
 * @param testId - ID of the test to submit
 * @param userId - ID of the analyst submitting the test
 * @returns The updated test record
 */
export async function submitForReview(testId: string, userId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      sample: { select: { organizationId: true } },
    },
  });

  if (!test) {
    throw new NotFoundError('Test', testId);
  }

  validateTransition('TEST', test.status, 'IN_REVIEW');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.test.update({
      where: { id: testId },
      data: { status: 'IN_REVIEW' },
    });

    await tx.approvalAction.create({
      data: {
        entityType: 'TEST',
        entityId: testId,
        action: 'SUBMIT_FOR_REVIEW',
        level: 0,
        performedById: userId,
        previousStatus: test.status,
        newStatus: 'IN_REVIEW',
        comments: null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: test.sample.organizationId,
        userId,
        entityType: 'TEST',
        entityId: testId,
        action: 'SUBMIT_FOR_REVIEW',
        changes: {
          previousStatus: test.status,
          newStatus: 'IN_REVIEW',
        },
      },
    });

    return updated;
  });
}

/**
 * Performs a peer review on a test in IN_REVIEW status.
 * The reviewer may either approve (advancing to APPROVED via level-1 review)
 * or reject (returning the test to IN_PROGRESS via REVIEW_REJECTED).
 *
 * A reviewer cannot review their own test.
 *
 * @param testId - ID of the test to review
 * @param reviewerId - ID of the reviewing user
 * @param action - 'approve' or 'reject'
 * @param comments - Optional reviewer comments
 * @returns The updated test record
 */
export async function reviewTest(
  testId: string,
  reviewerId: string,
  action: 'approve' | 'reject',
  comments?: string,
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      sample: { select: { organizationId: true } },
    },
  });

  if (!test) {
    throw new NotFoundError('Test', testId);
  }

  if (test.status !== 'IN_REVIEW') {
    throw new ConflictError(
      `Test must be in IN_REVIEW status to be reviewed (current: ${test.status})`,
    );
  }

  // Prevent self-review
  if (test.assignedToId === reviewerId) {
    throw new ForbiddenError('Analysts cannot review their own tests');
  }

  // Verify reviewer role
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { id: true, role: true, isActive: true },
  });

  if (!reviewer || !reviewer.isActive) {
    throw new NotFoundError('User', reviewerId);
  }

  if (!REVIEWER_ROLES.has(reviewer.role)) {
    throw new ForbiddenError(
      `User role '${reviewer.role}' is not authorized to review tests`,
    );
  }

  const targetStatus = action === 'approve' ? 'APPROVED' : 'REVIEW_REJECTED';
  validateTransition('TEST', test.status, targetStatus);

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const updateData: Record<string, unknown> = {
      status: targetStatus,
      reviewedById: reviewerId,
      reviewedDate: now,
      reviewNotes: comments ?? null,
    };

    // If approved at review level, also stamp approval fields when there is
    // no separate approval step configured (single-level review = approval).
    if (action === 'approve') {
      updateData.approvedById = reviewerId;
      updateData.approvedDate = now;
      updateData.approvalNotes = comments ?? null;
    }

    const updated = await tx.test.update({
      where: { id: testId },
      data: updateData as any,
    });

    await tx.approvalAction.create({
      data: {
        entityType: 'TEST',
        entityId: testId,
        action: action === 'approve' ? 'REVIEW_APPROVE' : 'REVIEW_REJECT',
        level: 1,
        performedById: reviewerId,
        previousStatus: test.status,
        newStatus: targetStatus,
        comments: comments ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: test.sample.organizationId,
        userId: reviewerId,
        entityType: 'TEST',
        entityId: testId,
        action: action === 'approve' ? 'REVIEW_APPROVE' : 'REVIEW_REJECT',
        changes: {
          previousStatus: test.status,
          newStatus: targetStatus,
          reviewNotes: comments,
        },
      },
    });

    return updated;
  });
}

/**
 * Performs a final (level-2) approval on a test that has already passed
 * peer review. This is used in labs that require a two-tier approval
 * process (reviewer + approver).
 *
 * @param testId - ID of the test to approve
 * @param approverId - ID of the approving user
 * @param comments - Optional approver comments
 * @returns The updated test record
 */
export async function approveTest(
  testId: string,
  approverId: string,
  comments?: string,
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      reviewedById: true,
      sample: { select: { organizationId: true } },
    },
  });

  if (!test) {
    throw new NotFoundError('Test', testId);
  }

  // This function handles the case where a separate approval step is used
  // after review. The test should be in IN_REVIEW when the two-tier flow
  // is used, but we also allow calling this directly on COMPLETED tests
  // as a single-step approval.
  if (test.status !== 'IN_REVIEW' && test.status !== 'COMPLETED') {
    throw new ConflictError(
      `Test must be in IN_REVIEW or COMPLETED status to be approved (current: ${test.status})`,
    );
  }

  // Prevent the analyst from approving their own work
  if (test.assignedToId === approverId) {
    throw new ForbiddenError('Analysts cannot approve their own tests');
  }

  // Prevent the reviewer from also being the approver in two-tier flow
  if (test.reviewedById === approverId) {
    throw new ForbiddenError(
      'The reviewer cannot also be the final approver for the same test',
    );
  }

  // Verify approver role
  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, role: true, isActive: true },
  });

  if (!approver || !approver.isActive) {
    throw new NotFoundError('User', approverId);
  }

  if (!APPROVER_ROLES.has(approver.role)) {
    throw new ForbiddenError(
      `User role '${approver.role}' is not authorized for final test approval`,
    );
  }

  validateTransition('TEST', test.status, 'APPROVED');

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const updated = await tx.test.update({
      where: { id: testId },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedDate: now,
        approvalNotes: comments ?? null,
      },
    });

    await tx.approvalAction.create({
      data: {
        entityType: 'TEST',
        entityId: testId,
        action: 'APPROVE',
        level: 2,
        performedById: approverId,
        previousStatus: test.status,
        newStatus: 'APPROVED',
        comments: comments ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: test.sample.organizationId,
        userId: approverId,
        entityType: 'TEST',
        entityId: testId,
        action: 'FINAL_APPROVAL',
        changes: {
          previousStatus: test.status,
          newStatus: 'APPROVED',
          approvalNotes: comments,
        },
      },
    });

    return updated;
  });
}

/**
 * Returns the queue of tests that are pending the given user's action
 * based on their role.
 *
 * - REVIEWER_ROLES see tests in IN_REVIEW status.
 * - APPROVER_ROLES additionally see tests awaiting final approval
 *   (IN_REVIEW that have already been reviewed once but not yet approved).
 *
 * @param orgId - Organisation ID
 * @param userRole - The calling user's role
 * @returns Array of test records with sample and method details
 */
export async function getApprovalQueue(orgId: string, userRole: string) {
  const statusFilter: string[] = [];

  if (REVIEWER_ROLES.has(userRole) || APPROVER_ROLES.has(userRole)) {
    statusFilter.push('IN_REVIEW');
  }

  if (statusFilter.length === 0) {
    throw new ForbiddenError(
      `Role '${userRole}' does not have access to the approval queue`,
    );
  }

  const tests = await prisma.test.findMany({
    where: {
      sample: { organizationId: orgId },
      status: { in: statusFilter as any },
    },
    include: {
      sample: {
        select: {
          id: true,
          sampleNumber: true,
          name: true,
          orderId: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              clientId: true,
              priority: true,
              dueDate: true,
            },
          },
        },
      },
      testMethod: {
        select: { id: true, code: true, name: true, category: true },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true },
      },
      reviewedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [
      { sample: { order: { dueDate: 'asc' } } },
      { createdAt: 'asc' },
    ],
  });

  return tests;
}

/**
 * Checks whether all tests associated with an order have been approved.
 * If every test on every sample is either APPROVED or CANCELLED, and at
 * least one test is APPROVED, the order is considered fully approved.
 *
 * @param orderId - The order to check
 * @returns An object indicating the overall approval status and test counts
 */
export async function checkOrderApprovalStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      samples: {
        select: {
          id: true,
          tests: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  const allTests = order.samples.flatMap((s) => s.tests);
  const totalTests = allTests.length;

  if (totalTests === 0) {
    return {
      orderId,
      isFullyApproved: false,
      totalTests: 0,
      approvedTests: 0,
      cancelledTests: 0,
      pendingTests: 0,
      reason: 'No tests found on order',
    };
  }

  const approvedTests = allTests.filter((t) => t.status === 'APPROVED').length;
  const cancelledTests = allTests.filter((t) => t.status === 'CANCELLED').length;
  const pendingTests = totalTests - approvedTests - cancelledTests;
  const isFullyApproved = pendingTests === 0 && approvedTests > 0;

  return {
    orderId,
    isFullyApproved,
    totalTests,
    approvedTests,
    cancelledTests,
    pendingTests,
    reason: isFullyApproved
      ? 'All tests are approved or cancelled'
      : `${pendingTests} test(s) still pending approval`,
  };
}
