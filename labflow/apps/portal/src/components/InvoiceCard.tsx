'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  XCircle,
  Eye,
} from 'lucide-react';

const INVOICE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: FileText },
  PENDING_APPROVAL: { label: 'Pending', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-indigo-600', bgColor: 'bg-indigo-50', icon: CheckCircle2 },
  SENT: { label: 'Sent', color: 'text-sky-600', bgColor: 'bg-sky-50', icon: FileText },
  VIEWED: { label: 'Viewed', color: 'text-cyan-600', bgColor: 'bg-cyan-50', icon: Eye },
  PARTIALLY_PAID: { label: 'Partial', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: DollarSign },
  PAID: { label: 'Paid', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle2 },
  OVERDUE: { label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertTriangle },
  VOID: { label: 'Void', color: 'text-gray-400', bgColor: 'bg-gray-50', icon: XCircle },
  WRITTEN_OFF: { label: 'Written Off', color: 'text-gray-400', bgColor: 'bg-gray-50', icon: XCircle },
};

interface InvoiceCardProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string | null;
    dueDate: string | null;
    total: number;
    balanceDue: number;
    isOverdue: boolean;
  };
}

export default function InvoiceCard({ invoice }: InvoiceCardProps) {
  const displayStatus = invoice.isOverdue && invoice.status !== 'PAID' ? 'OVERDUE' : invoice.status;
  const config = INVOICE_STATUS_CONFIG[displayStatus] || {
    label: displayStatus,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    icon: FileText,
  };
  const StatusIcon = config.icon;

  const canPay =
    invoice.balanceDue > 0 &&
    !['DRAFT', 'VOID', 'WRITTEN_OFF', 'PAID'].includes(invoice.status);

  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className="block rounded-lg border border-border bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
          {invoice.issueDate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Issued: {format(new Date(invoice.issueDate), 'MMM d, yyyy')}
            </p>
          )}
          {invoice.dueDate && (
            <p className="text-xs text-muted-foreground">
              Due: {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <div
          className={clsx(
            'flex items-center gap-1 rounded-full px-2.5 py-1',
            config.bgColor,
            config.color
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{config.label}</span>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold text-foreground">
            ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        {invoice.balanceDue > 0 && invoice.balanceDue !== invoice.total && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className="text-sm font-medium text-destructive">
              ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {canPay && (
        <div className="mt-3 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <DollarSign className="h-3 w-3" />
            Pay Now
          </span>
        </div>
      )}
    </Link>
  );
}
