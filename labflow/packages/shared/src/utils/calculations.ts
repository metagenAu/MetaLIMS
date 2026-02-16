// ============================================================
// Derived Result Formulas & Calculations
// ============================================================

/**
 * Calculates the percent recovery for a spiked sample.
 * Recovery % = ((Spiked Result - Unspiked Result) / Spike Amount) * 100
 *
 * @param spikedResult - The measured value of the spiked sample
 * @param unspikedResult - The measured value of the unspiked sample
 * @param spikeAmount - The known amount of spike added
 * @returns The recovery percentage, or null if spike amount is zero
 */
export function calculateRecovery(
  spikedResult: number,
  unspikedResult: number,
  spikeAmount: number
): number | null {
  if (spikeAmount === 0) {
    return null;
  }
  return ((spikedResult - unspikedResult) / spikeAmount) * 100;
}

/**
 * Calculates Relative Percent Difference (RPD) between two duplicate measurements.
 * RPD = |Value1 - Value2| / ((Value1 + Value2) / 2) * 100
 *
 * @param value1 - First measurement
 * @param value2 - Second (duplicate) measurement
 * @returns The RPD percentage, or null if the mean is zero
 */
export function calculateRPD(value1: number, value2: number): number | null {
  const mean = (value1 + value2) / 2;
  if (mean === 0) {
    return null;
  }
  return (Math.abs(value1 - value2) / mean) * 100;
}

/**
 * Calculates Relative Standard Deviation (RSD / %CV) for a set of values.
 * RSD = (Standard Deviation / Mean) * 100
 *
 * @param values - Array of numeric measurements
 * @returns The RSD percentage, or null if mean is zero or less than 2 values
 */
export function calculateRSD(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) {
    return null;
  }
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  return (stdDev / Math.abs(mean)) * 100;
}

/**
 * Applies a dilution factor to a raw measurement to get the corrected value.
 * Corrected Value = Raw Value * Dilution Factor
 *
 * @param rawValue - The raw (undiluted) measurement
 * @param dilutionFactor - The dilution factor (must be >= 1)
 * @returns The dilution-corrected value
 */
export function applyDilutionFactor(rawValue: number, dilutionFactor: number): number {
  return rawValue * dilutionFactor;
}

/**
 * Determines the pass/fail status of a result against specification limits.
 *
 * @param value - The measured value
 * @param limits - The specification limits to check against
 * @returns 'PASS', 'FAIL', 'WARNING', or 'NOT_APPLICABLE'
 */
export function evaluateSpecLimit(
  value: number,
  limits: {
    limitType: 'MAXIMUM' | 'MINIMUM' | 'RANGE' | 'EXACT' | 'INFORMATIONAL';
    minValue?: number | null;
    maxValue?: number | null;
    targetValue?: number | null;
    warningMin?: number | null;
    warningMax?: number | null;
  }
): 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE' {
  if (limits.limitType === 'INFORMATIONAL') {
    return 'NOT_APPLICABLE';
  }

  // Check hard limits first
  switch (limits.limitType) {
    case 'MAXIMUM':
      if (limits.maxValue != null && value > limits.maxValue) {
        return 'FAIL';
      }
      break;
    case 'MINIMUM':
      if (limits.minValue != null && value < limits.minValue) {
        return 'FAIL';
      }
      break;
    case 'RANGE':
      if (limits.minValue != null && value < limits.minValue) {
        return 'FAIL';
      }
      if (limits.maxValue != null && value > limits.maxValue) {
        return 'FAIL';
      }
      break;
    case 'EXACT':
      if (limits.targetValue != null && value !== limits.targetValue) {
        return 'FAIL';
      }
      break;
  }

  // Check warning limits
  if (limits.warningMin != null && value < limits.warningMin) {
    return 'WARNING';
  }
  if (limits.warningMax != null && value > limits.warningMax) {
    return 'WARNING';
  }

  return 'PASS';
}

/**
 * Rounds a number to the specified number of decimal places.
 *
 * @param value - The value to round
 * @param decimalPlaces - Number of decimal places
 * @returns The rounded value
 */
export function roundToDecimalPlaces(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

/**
 * Formats a numeric result for display, applying proper rounding and
 * handling special cases like "ND" (not detected) and qualifiers.
 *
 * @param value - The numeric value (null if not detected)
 * @param decimalPlaces - Number of decimal places for rounding
 * @param isDetected - Whether the analyte was detected
 * @param reportingLimit - The reporting limit (for ND display)
 * @param qualifier - Optional qualifier (e.g., "<", ">", "~")
 * @returns Formatted result string
 */
export function formatResultValue(
  value: number | null,
  decimalPlaces: number = 2,
  isDetected: boolean | null = null,
  reportingLimit: number | null = null,
  qualifier: string | null = null
): string {
  if (isDetected === false) {
    if (reportingLimit != null) {
      return `< ${roundToDecimalPlaces(reportingLimit, decimalPlaces)}`;
    }
    return 'ND';
  }

  if (value == null) {
    return '--';
  }

  const rounded = roundToDecimalPlaces(value, decimalPlaces);
  const formatted = rounded.toFixed(decimalPlaces);

  if (qualifier) {
    return `${qualifier} ${formatted}`;
  }

  return formatted;
}

/**
 * Calculates invoice line item total.
 * Total = (Quantity * UnitPrice) - Discount
 *
 * @param quantity - Number of units
 * @param unitPrice - Price per unit
 * @param discount - Discount amount (absolute, not percentage)
 * @returns The line item total
 */
export function calculateLineItemTotal(
  quantity: number,
  unitPrice: number,
  discount: number = 0
): number {
  return roundToDecimalPlaces(quantity * unitPrice - discount, 2);
}

/**
 * Calculates full invoice totals from line items and modifiers.
 *
 * @param lineItems - Array of line items with quantity, unitPrice, and discount
 * @param discountPercent - Overall invoice discount percentage (0-100)
 * @param taxRate - Tax rate as a decimal (e.g. 0.08 for 8%)
 * @param rushSurcharge - Flat rush surcharge amount
 * @returns Calculated invoice amounts
 */
export function calculateInvoiceTotals(
  lineItems: Array<{ quantity: number; unitPrice: number; discount?: number }>,
  discountPercent: number = 0,
  taxRate: number = 0,
  rushSurcharge: number = 0
): {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  rushSurcharge: number;
  total: number;
} {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + calculateLineItemTotal(item.quantity, item.unitPrice, item.discount ?? 0),
    0
  );

  const discountAmount = roundToDecimalPlaces((subtotal * discountPercent) / 100, 2);
  const afterDiscount = subtotal - discountAmount;
  const taxableAmount = roundToDecimalPlaces(afterDiscount + rushSurcharge, 2);
  const taxAmount = roundToDecimalPlaces(taxableAmount * taxRate, 2);
  const total = roundToDecimalPlaces(taxableAmount + taxAmount, 2);

  return {
    subtotal: roundToDecimalPlaces(subtotal, 2),
    discountAmount,
    taxableAmount,
    taxAmount,
    rushSurcharge: roundToDecimalPlaces(rushSurcharge, 2),
    total,
  };
}

/**
 * Calculates the remaining balance on an invoice after payments.
 *
 * @param invoiceTotal - The total invoice amount
 * @param paymentsTotal - Sum of all completed payments
 * @param creditNotesTotal - Sum of all credit notes
 * @returns The remaining balance due (minimum 0)
 */
export function calculateBalanceDue(
  invoiceTotal: number,
  paymentsTotal: number,
  creditNotesTotal: number = 0
): number {
  const balance = invoiceTotal - paymentsTotal - creditNotesTotal;
  return roundToDecimalPlaces(Math.max(0, balance), 2);
}

/**
 * Calculates the completion percentage for an order or sample.
 *
 * @param totalTests - Total number of tests
 * @param completedTests - Number of completed/approved tests
 * @returns Percentage (0-100)
 */
export function calculateCompletionPercentage(
  totalTests: number,
  completedTests: number
): number {
  if (totalTests === 0) {
    return 0;
  }
  return roundToDecimalPlaces((completedTests / totalTests) * 100, 1);
}

/**
 * Calculates the mean of an array of numbers.
 *
 * @param values - Array of numeric values
 * @returns The arithmetic mean, or null if the array is empty
 */
export function calculateMean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculates the standard deviation of an array of numbers (sample std dev).
 *
 * @param values - Array of numeric values
 * @returns The sample standard deviation, or null if fewer than 2 values
 */
export function calculateStdDev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
