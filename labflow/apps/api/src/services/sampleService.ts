import { prisma } from '@labflow/db';
import type { SampleStatus } from '@labflow/db';
import type {
  CreateSampleInput,
  ReceiveSampleInput,
} from '@labflow/shared/types';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../utils/errors';
import { validateTransition, executeTransition } from './workflowEngine';

// ============================================================
// Helpers
// ============================================================

/**
 * Generates the next sequential sample number for an organisation.
 * Format: S-{YEAR}-{ZERO_PADDED_SEQ}  e.g. S-2026-000042
 */
async function generateSampleNumber(
  orgId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<string> {
  const year = new Date().getFullYear();

  const sequence = await tx.sequence.upsert({
    where: {
      organizationId_entityType_year: {
        organizationId: orgId,
        entityType: 'SAMPLE',
        year,
      },
    },
    update: { currentValue: { increment: 1 } },
    create: {
      organizationId: orgId,
      entityType: 'SAMPLE',
      year,
      currentValue: 1,
    },
  });

  return `S-${year}-${String(sequence.currentValue).padStart(6, '0')}`;
}

/**
 * Generates a globally unique barcode value.
 * Format: LF-{ORGPREFIX}-{TIMESTAMP_BASE36}-{RANDOM}
 */
function generateBarcode(orgId: string): string {
  const orgPrefix = orgId.substring(0, 6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LF-${orgPrefix}-${ts}-${rand}`;
}

// ============================================================
// Public API
// ============================================================

/**
 * Registers a new sample, auto-generating a human-readable sample number and
 * a scannable barcode. The sample starts in REGISTERED status.
 *
 * @param data - Fields for the new sample (orderId is required)
 * @param orgId - The organisation the sample belongs to
 * @returns The newly created sample record
 */
export async function registerSample(
  data: CreateSampleInput,
  orgId: string,
) {
  // Validate the parent order exists and belongs to the org
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { id: true, organizationId: true, status: true },
  });

  if (!order || order.organizationId !== orgId) {
    throw new NotFoundError('Order', data.orderId);
  }

  if (order.status === 'CANCELLED') {
    throw new ConflictError('Cannot add samples to a cancelled order');
  }

  return prisma.$transaction(async (tx) => {
    const sampleNumber = await generateSampleNumber(orgId, tx);
    const barcodeValue = generateBarcode(orgId);

    const sample = await tx.sample.create({
      data: {
        organizationId: orgId,
        orderId: data.orderId,
        sampleNumber,
        barcodeValue,
        clientSampleId: data.clientSampleId ?? null,
        name: data.name ?? null,
        description: data.description ?? null,
        matrix: data.matrix ?? null,
        sampleType: data.sampleType ?? null,
        collectedDate: data.collectedDate ?? null,
        collectedBy: data.collectedBy ?? null,
        collectionLocation: data.collectionLocation ?? null,
        collectionMethod: data.collectionMethod ?? null,
        conditionOnReceipt: data.conditionOnReceipt ?? null,
        temperatureOnReceipt: data.temperatureOnReceipt ?? null,
        storageCondition: data.storageCondition ?? null,
        parentSampleId: data.parentSampleId ?? null,
        quantity: data.quantity ?? null,
        quantityUnit: data.quantityUnit ?? null,
        lotNumber: data.lotNumber ?? null,
        batchNumber: data.batchNumber ?? null,
        expirationDate: data.expirationDate ?? null,
        tags: data.tags ?? [],
        customFields: data.customFields ?? {},
        notes: data.notes ?? null,
        status: 'REGISTERED',
      },
    });

    // Initial chain-of-custody entry
    await tx.chainOfCustodyEntry.create({
      data: {
        sampleId: sample.id,
        action: 'REGISTERED',
        performedById: sample.createdById ?? 'system',
        notes: 'Sample registered in system',
      },
    });

    return sample;
  });
}

/**
 * Marks a sample as received and creates a chain-of-custody entry.
 * Transitions the sample from REGISTERED to RECEIVED.
 *
 * @param sampleId - ID of the sample to receive
 * @param data - Reception data (receivedById, condition, temperature, etc.)
 * @returns The updated sample record
 */
export async function receiveSample(
  sampleId: string,
  data: ReceiveSampleInput,
) {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    select: { id: true, status: true, organizationId: true },
  });

  if (!sample) {
    throw new NotFoundError('Sample', sampleId);
  }

  validateTransition('SAMPLE', sample.status, 'RECEIVED');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sample.update({
      where: { id: sampleId },
      data: {
        status: 'RECEIVED',
        receivedDate: data.receivedDate ?? new Date(),
        receivedById: data.receivedById,
        conditionOnReceipt: data.conditionOnReceipt ?? null,
        temperatureOnReceipt: data.temperatureOnReceipt ?? null,
        storageLocationId: data.storageLocationId ?? null,
        storageCondition: data.storageCondition ?? null,
      },
    });

    await tx.chainOfCustodyEntry.create({
      data: {
        sampleId,
        action: 'RECEIVED',
        toLocation: data.storageLocationId ?? null,
        performedById: data.receivedById,
        temperature: data.temperatureOnReceipt ?? null,
        notes: data.notes ?? 'Sample received at laboratory',
      },
    });

    // Record audit
    await tx.auditLog.create({
      data: {
        organizationId: sample.organizationId,
        userId: data.receivedById,
        entityType: 'SAMPLE',
        entityId: sampleId,
        action: 'RECEIVED',
        changes: {
          previousStatus: sample.status,
          newStatus: 'RECEIVED',
          conditionOnReceipt: data.conditionOnReceipt,
          temperatureOnReceipt: data.temperatureOnReceipt,
        },
      },
    });

    return updated;
  });
}

/**
 * Assigns a sample to a storage location and creates a chain-of-custody
 * entry. Transitions the sample to IN_STORAGE.
 *
 * @param sampleId - ID of the sample
 * @param locationId - Target storage location ID
 * @param userId - The user performing the storage action
 * @returns The updated sample record
 */
export async function storeSample(
  sampleId: string,
  locationId: string,
  userId: string,
) {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      storageLocationId: true,
    },
  });

  if (!sample) {
    throw new NotFoundError('Sample', sampleId);
  }

  validateTransition('SAMPLE', sample.status, 'IN_STORAGE');

  const location = await prisma.storageLocation.findUnique({
    where: { id: locationId },
    select: { id: true, organizationId: true, name: true, capacity: true, currentCount: true, isActive: true },
  });

  if (!location || location.organizationId !== sample.organizationId) {
    throw new NotFoundError('StorageLocation', locationId);
  }

  if (!location.isActive) {
    throw new ValidationError('Storage location is not active');
  }

  if (location.capacity !== null && location.currentCount >= location.capacity) {
    throw new ConflictError('Storage location is at capacity');
  }

  return prisma.$transaction(async (tx) => {
    // Decrement count at previous location if the sample was stored somewhere
    if (sample.storageLocationId) {
      await tx.storageLocation.update({
        where: { id: sample.storageLocationId },
        data: { currentCount: { decrement: 1 } },
      });
    }

    const updated = await tx.sample.update({
      where: { id: sampleId },
      data: {
        status: 'IN_STORAGE',
        storageLocationId: locationId,
      },
    });

    // Increment count at new location
    await tx.storageLocation.update({
      where: { id: locationId },
      data: { currentCount: { increment: 1 } },
    });

    await tx.chainOfCustodyEntry.create({
      data: {
        sampleId,
        action: 'STORED',
        fromLocation: sample.storageLocationId ?? null,
        toLocation: locationId,
        performedById: userId,
        notes: `Stored in ${location.name}`,
      },
    });

    return updated;
  });
}

/**
 * Removes a sample from its storage location and creates a chain-of-custody
 * entry. Transitions the sample to IN_PROGRESS (ready for testing).
 *
 * @param sampleId - ID of the sample
 * @param userId - The user retrieving the sample
 * @returns The updated sample record
 */
export async function retrieveSample(
  sampleId: string,
  userId: string,
) {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      storageLocationId: true,
    },
  });

  if (!sample) {
    throw new NotFoundError('Sample', sampleId);
  }

  validateTransition('SAMPLE', sample.status, 'IN_PROGRESS');

  return prisma.$transaction(async (tx) => {
    // Decrement storage count
    if (sample.storageLocationId) {
      await tx.storageLocation.update({
        where: { id: sample.storageLocationId },
        data: { currentCount: { decrement: 1 } },
      });
    }

    const updated = await tx.sample.update({
      where: { id: sampleId },
      data: {
        status: 'IN_PROGRESS',
        storageLocationId: null,
      },
    });

    await tx.chainOfCustodyEntry.create({
      data: {
        sampleId,
        action: 'RETRIEVED',
        fromLocation: sample.storageLocationId ?? null,
        toLocation: null,
        performedById: userId,
        notes: 'Retrieved from storage for testing',
      },
    });

    return updated;
  });
}

/**
 * Records the disposal of a sample.
 *
 * @param sampleId - ID of the sample to dispose
 * @param data - Disposal details
 * @returns The updated sample record
 */
export async function disposeSample(
  sampleId: string,
  data: { disposedById: string; disposalMethod: string; notes?: string },
) {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      storageLocationId: true,
    },
  });

  if (!sample) {
    throw new NotFoundError('Sample', sampleId);
  }

  // Allow disposal from REPORTED or IN_STORAGE
  validateTransition('SAMPLE', sample.status, 'DISPOSED');

  return prisma.$transaction(async (tx) => {
    // Free up storage slot
    if (sample.storageLocationId) {
      await tx.storageLocation.update({
        where: { id: sample.storageLocationId },
        data: { currentCount: { decrement: 1 } },
      });
    }

    const updated = await tx.sample.update({
      where: { id: sampleId },
      data: {
        status: 'DISPOSED',
        disposalDate: new Date(),
        disposalMethod: data.disposalMethod,
        disposedById: data.disposedById,
        storageLocationId: null,
      },
    });

    await tx.chainOfCustodyEntry.create({
      data: {
        sampleId,
        action: 'DISPOSED',
        fromLocation: sample.storageLocationId ?? null,
        performedById: data.disposedById,
        notes: data.notes ?? `Disposed via ${data.disposalMethod}`,
      },
    });

    return updated;
  });
}

/**
 * Creates an aliquot (child sample) from a parent sample. The aliquot
 * inherits common metadata from the parent but gets its own sample number
 * and barcode.
 *
 * @param parentId - The parent sample's ID
 * @param data - Override data for the child sample
 * @returns The newly created aliquot sample
 */
export async function createAliquot(
  parentId: string,
  data: {
    name?: string;
    quantity?: number;
    quantityUnit?: string;
    createdById: string;
    notes?: string;
  },
) {
  const parent = await prisma.sample.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      organizationId: true,
      orderId: true,
      matrix: true,
      sampleType: true,
      collectedDate: true,
      collectedBy: true,
      collectionLocation: true,
      collectionMethod: true,
      storageCondition: true,
      lotNumber: true,
      batchNumber: true,
      status: true,
    },
  });

  if (!parent) {
    throw new NotFoundError('Sample', parentId);
  }

  // Parent must not be disposed or cancelled
  if (parent.status === 'DISPOSED' || parent.status === 'CANCELLED') {
    throw new ConflictError(
      `Cannot create aliquot from a sample in status '${parent.status}'`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const sampleNumber = await generateSampleNumber(parent.organizationId, tx);
    const barcodeValue = generateBarcode(parent.organizationId);

    const aliquot = await tx.sample.create({
      data: {
        organizationId: parent.organizationId,
        orderId: parent.orderId,
        sampleNumber,
        barcodeValue,
        parentSampleId: parentId,
        name: data.name ?? `Aliquot of ${parentId}`,
        matrix: parent.matrix,
        sampleType: parent.sampleType,
        collectedDate: parent.collectedDate,
        collectedBy: parent.collectedBy,
        collectionLocation: parent.collectionLocation,
        collectionMethod: parent.collectionMethod,
        storageCondition: parent.storageCondition,
        lotNumber: parent.lotNumber,
        batchNumber: parent.batchNumber,
        quantity: data.quantity ?? null,
        quantityUnit: data.quantityUnit ?? null,
        createdById: data.createdById,
        notes: data.notes ?? null,
        status: 'REGISTERED',
      },
    });

    await tx.chainOfCustodyEntry.create({
      data: {
        sampleId: aliquot.id,
        action: 'ALIQUOT_CREATED',
        performedById: data.createdById,
        notes: `Created as aliquot from parent sample ${parent.id}`,
      },
    });

    return aliquot;
  });
}

/**
 * Looks up a sample by its barcode value within an organisation.
 *
 * @param barcode - The barcode string to search for
 * @param orgId - The organisation to scope the search to
 * @returns The matching sample with related order and test data
 */
export async function lookupByBarcode(barcode: string, orgId: string) {
  const sample = await prisma.sample.findUnique({
    where: { barcodeValue: barcode },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          clientId: true,
          status: true,
          priority: true,
          dueDate: true,
        },
      },
      storageLocation: {
        select: { id: true, name: true, type: true, building: true, room: true },
      },
      tests: {
        select: {
          id: true,
          testMethodId: true,
          status: true,
          assignedToId: true,
          overallResult: true,
        },
      },
      chainOfCustody: {
        orderBy: { performedAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!sample || sample.organizationId !== orgId) {
    throw new NotFoundError('Sample', barcode);
  }

  return sample;
}

/**
 * Updates a sample's status after validating the transition is allowed by
 * the state machine.
 *
 * @param sampleId - ID of the sample
 * @param newStatus - The target status
 * @param userId - The user performing the update
 * @returns The updated sample record
 */
export async function updateSampleStatus(
  sampleId: string,
  newStatus: SampleStatus,
  userId: string,
) {
  return executeTransition('SAMPLE', sampleId, newStatus, userId);
}

/**
 * Checks whether all tests on a sample have reached a terminal state
 * (APPROVED or CANCELLED) and, if so, automatically transitions the sample
 * status to TESTING_COMPLETE.
 *
 * This is intended to be called after each test status change.
 *
 * @param sampleId - The sample to check
 * @returns The updated sample if a transition occurred, or null if not
 */
export async function checkAllTestsStatus(sampleId: string) {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      tests: {
        select: { id: true, status: true },
      },
    },
  });

  if (!sample) {
    throw new NotFoundError('Sample', sampleId);
  }

  // Only auto-advance if the sample is currently IN_PROGRESS
  if (sample.status !== 'IN_PROGRESS') {
    return null;
  }

  const tests = sample.tests;

  // Must have at least one test
  if (tests.length === 0) {
    return null;
  }

  const terminalStatuses = new Set(['APPROVED', 'CANCELLED']);
  const allTerminal = tests.every((t) => terminalStatuses.has(t.status));

  if (!allTerminal) {
    return null;
  }

  // All tests are done -- advance sample to TESTING_COMPLETE
  return prisma.$transaction(async (tx) => {
    const updated = await tx.sample.update({
      where: { id: sampleId },
      data: { status: 'TESTING_COMPLETE' },
    });

    await tx.auditLog.create({
      data: {
        organizationId: sample.organizationId,
        userId: null,
        entityType: 'SAMPLE',
        entityId: sampleId,
        action: 'AUTO_STATUS_TRANSITION',
        changes: {
          previousStatus: 'IN_PROGRESS',
          newStatus: 'TESTING_COMPLETE',
          reason: 'All tests reached terminal status',
        },
      },
    });

    return updated;
  });
}
