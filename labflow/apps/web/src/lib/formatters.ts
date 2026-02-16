import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

export function formatDate(
  dateString: string | Date | null | undefined,
  formatStr: string = 'MMM d, yyyy'
): string {
  if (!dateString) return '--';
  const date =
    typeof dateString === 'string' ? parseISO(dateString) : dateString;
  if (!isValid(date)) return '--';
  return format(date, formatStr);
}

export function formatDateTime(
  dateString: string | Date | null | undefined
): string {
  return formatDate(dateString, 'MMM d, yyyy h:mm a');
}

export function formatRelativeTime(
  dateString: string | Date | null | undefined
): string {
  if (!dateString) return '--';
  const date =
    typeof dateString === 'string' ? parseISO(dateString) : dateString;
  if (!isValid(date)) return '--';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatSampleId(id: string): string {
  return id.toUpperCase();
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11) {
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function truncate(str: string, length: number = 50): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
