import { prisma } from '@labflow/db';
import { Decimal } from '@labflow/db';
import { NotFoundError, ValidationError } from '../utils/errors';

// ============================================================
// Types
// ============================================================

/** A single tier in a volume-based pricing schedule. */
interface VolumeTier {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
}

/** The result of a single-line price calculation. */
export interface PriceCalculation {
  testMethodId: string;
  priceListId: string;
  baseUnitPrice: number;
  effectiveUnitPrice: number;
  quantity: number;
  subtotal: number;
  rushSurchargePercent: number;
  rushSurchargeAmount: number;
  total: number;
  tierApplied: string | null;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Resolves the applicable volume tier for a given quantity.
 * Returns the matching tier or null when no tiers apply.
 */
function resolveTier(
  tiers: VolumeTier[],
  quantity: number,
): VolumeTier | null {
  if (!tiers || tiers.length === 0) return null;

  // Sort tiers ascending by minQuantity
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  for (const tier of sorted) {
    const max = tier.maxQuantity ?? Infinity;
    if (quantity >= tier.minQuantity && quantity <= max) {
      return tier;
    }
  }

  return null;
}

// ============================================================
// Public API
// ============================================================

/**
 * Calculates the price for a specific test method on a given price list,
 * accounting for volume tiers and optional rush surcharges.
 *
 * @param testMethodId - The test method to price
 * @param priceListId - The price list to look up rates from
 * @param quantity - Number of tests / samples (default 1)
 * @param isRush - Whether a rush surcharge should be applied
 * @returns A detailed price calculation breakdown
 */
export async function calculatePrice(
  testMethodId: string,
  priceListId: string,
  quantity: number = 1,
  isRush: boolean = false,
): Promise<PriceCalculation> {
  if (quantity <= 0) {
    throw new ValidationError('Quantity must be greater than zero');
  }

  const item = await prisma.priceListItem.findUnique({
    where: {
      priceListId_testMethodId: {
        priceListId,
        testMethodId,
      },
    },
  });

  if (!item) {
    throw new NotFoundError(
      'PriceListItem',
      `priceList=${priceListId}, testMethod=${testMethodId}`,
    );
  }

  const baseUnitPrice = Number(item.unitPrice);
  let effectiveUnitPrice = baseUnitPrice;
  let tierApplied: string | null = null;

  // Apply volume tiers if configured
  const tiers = (item.volumeTiers as VolumeTier[]) ?? [];
  const matchedTier = resolveTier(tiers, quantity);

  if (matchedTier) {
    effectiveUnitPrice = matchedTier.unitPrice;
    const maxLabel = matchedTier.maxQuantity ?? '+';
    tierApplied = `${matchedTier.minQuantity}-${maxLabel}`;
  }

  // Enforce minimum charge
  const minimumCharge = item.minimumCharge ? Number(item.minimumCharge) : 0;
  let subtotal = effectiveUnitPrice * quantity;
  if (subtotal < minimumCharge) {
    subtotal = minimumCharge;
  }

  // Rush surcharge
  let rushSurchargePercent = 0;
  let rushSurchargeAmount = 0;

  if (isRush) {
    rushSurchargePercent = item.rushSurchargePercent
      ? Number(item.rushSurchargePercent)
      : 0;
    rushSurchargeAmount = subtotal * (rushSurchargePercent / 100);
  }

  const total = subtotal + rushSurchargeAmount;

  return {
    testMethodId,
    priceListId,
    baseUnitPrice,
    effectiveUnitPrice,
    quantity,
    subtotal: Math.round(subtotal * 100) / 100,
    rushSurchargePercent,
    rushSurchargeAmount: Math.round(rushSurchargeAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    tierApplied,
  };
}

/**
 * Resolves which price list should be used for a specific client.
 * Priority:
 *  1. Client-specific price list (client.priceListId)
 *  2. Organisation default price list (isDefault = true)
 *
 * @param clientId - The client to look up
 * @returns The applicable price list record
 */
export async function getClientPriceList(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      organizationId: true,
      priceListId: true,
      priceList: true,
    },
  });

  if (!client) {
    throw new NotFoundError('Client', clientId);
  }

  // 1. Client has an explicit price list assigned
  if (client.priceListId && client.priceList) {
    return client.priceList;
  }

  // 2. Fall back to the org's default active price list
  const defaultPriceList = await prisma.priceList.findFirst({
    where: {
      organizationId: client.organizationId,
      isDefault: true,
      isActive: true,
    },
  });

  if (!defaultPriceList) {
    throw new NotFoundError(
      'PriceList',
      `No default price list configured for organisation ${client.organizationId}`,
    );
  }

  return defaultPriceList;
}

/**
 * Computes the full pricing breakdown for an entire order, including every
 * sample / test combination, volume aggregation, rush surcharges, and
 * the order-level total.
 *
 * @param orderId - The order to price
 * @returns Object containing lineItems and order-level totals
 */
export async function calculateOrderTotal(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      rushRequested: true,
      rushApproved: true,
      rushSurchargePercent: true,
      samples: {
        select: {
          id: true,
          sampleNumber: true,
          tests: {
            select: {
              id: true,
              testMethodId: true,
              status: true,
              testMethod: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  const priceList = await getClientPriceList(order.clientId);
  const isRush = order.rushRequested && order.rushApproved;

  // Aggregate tests by testMethodId to compute volume
  const methodCounts = new Map<
    string,
    {
      testMethodId: string;
      code: string;
      name: string;
      sampleCount: number;
      testIds: string[];
    }
  >();

  for (const sample of order.samples) {
    for (const test of sample.tests) {
      // Skip cancelled tests
      if (test.status === 'CANCELLED') continue;

      const existing = methodCounts.get(test.testMethodId);
      if (existing) {
        existing.sampleCount += 1;
        existing.testIds.push(test.id);
      } else {
        methodCounts.set(test.testMethodId, {
          testMethodId: test.testMethodId,
          code: test.testMethod.code,
          name: test.testMethod.name,
          sampleCount: 1,
          testIds: [test.id],
        });
      }
    }
  }

  const lineItems: Array<PriceCalculation & { code: string; name: string }> = [];
  let orderSubtotal = 0;
  let orderRushSurcharge = 0;

  for (const [, method] of methodCounts) {
    try {
      const price = await calculatePrice(
        method.testMethodId,
        priceList.id,
        method.sampleCount,
        isRush,
      );
      lineItems.push({
        ...price,
        code: method.code,
        name: method.name,
      });
      orderSubtotal += price.subtotal;
      orderRushSurcharge += price.rushSurchargeAmount;
    } catch {
      // If a price list item is missing, add a zero-value placeholder
      lineItems.push({
        testMethodId: method.testMethodId,
        priceListId: priceList.id,
        baseUnitPrice: 0,
        effectiveUnitPrice: 0,
        quantity: method.sampleCount,
        subtotal: 0,
        rushSurchargePercent: 0,
        rushSurchargeAmount: 0,
        total: 0,
        tierApplied: null,
        code: method.code,
        name: method.name,
      });
    }
  }

  // If the order has its own rush surcharge override, apply it instead
  if (isRush && order.rushSurchargePercent) {
    const overridePercent = Number(order.rushSurchargePercent);
    orderRushSurcharge = orderSubtotal * (overridePercent / 100);
  }

  const orderTotal = orderSubtotal + orderRushSurcharge;

  return {
    orderId: order.id,
    priceListId: priceList.id,
    priceListName: priceList.name,
    lineItems,
    subtotal: Math.round(orderSubtotal * 100) / 100,
    rushSurcharge: Math.round(orderRushSurcharge * 100) / 100,
    total: Math.round(orderTotal * 100) / 100,
  };
}
