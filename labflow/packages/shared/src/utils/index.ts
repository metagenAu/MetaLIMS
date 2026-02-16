// ============================================================
// Utils - Barrel Export
// ============================================================

export {
  ENTITY_PREFIXES,
  type EntityType,
  padNumber,
  formatEntityId,
  parseEntityId,
  generateNextId,
  generateBarcodeValue,
  generateBatchId,
  isValidEntityId,
} from './idGenerator';

export {
  calculateRecovery,
  calculateRPD,
  calculateRSD,
  applyDilutionFactor,
  evaluateSpecLimit,
  roundToDecimalPlaces,
  formatResultValue,
  calculateLineItemTotal,
  calculateInvoiceTotals,
  calculateBalanceDue,
  calculateCompletionPercentage,
  calculateMean,
  calculateStdDev,
} from './calculations';

export {
  DEFAULT_TURNAROUND_DAYS,
  DEFAULT_RUSH_SURCHARGE_PERCENT,
  addBusinessDays,
  addCalendarDays,
  calculateOrderDueDate,
  calculateInvoiceDueDate,
  getBusinessDaysBetween,
  getDaysPastDue,
  getDaysRemaining,
  getUrgencyLevel,
  getUrgencyColor,
  checkHoldTime,
  calculateTestDueDate,
  calculateSLAMetrics,
} from './sla';
