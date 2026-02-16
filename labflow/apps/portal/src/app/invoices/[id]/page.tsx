'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  Printer,
} from 'lucide-react';
import { clsx } from 'clsx';
import PortalLayout from '@/components/PortalLayout';
import { usePortalInvoice } from '@/hooks/usePortalApi';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  PENDING_APPROVAL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  APPROVED: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  SENT: { bg: 'bg-sky-100', text: 'text-sky-700' },
  VIEWED: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  PARTIALLY_PAID: { bg: 'bg-amber-100', text: 'text-amber-700' },
  PAID: { bg: 'bg-green-100', text: 'text-green-700' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700' },
  VOID: { bg: 'bg-gray-100', text: 'text-gray-500' },
  WRITTEN_OFF: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const { data: invoice, isLoading, error, refetch } = usePortalInvoice(invoiceId);

  const canPay =
    invoice &&
    invoice.balanceDue > 0 &&
    !['DRAFT', 'VOID', 'WRITTEN_OFF', 'PAID'].includes(invoice.status);

  return (
    <PortalLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading invoice...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium text-destructive">Failed to load invoice</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {invoice && (
          <>
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    {invoice.invoiceNumber}
                  </h1>
                  {(() => {
                    const displayStatus =
                      invoice.isOverdue && invoice.status !== 'PAID'
                        ? 'OVERDUE'
                        : invoice.status;
                    const colors = STATUS_COLORS[displayStatus] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                    };
                    return (
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          colors.bg,
                          colors.text
                        )}
                      >
                        {displayStatus.replace(/_/g, ' ')}
                      </span>
                    );
                  })()}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {invoice.issueDate && (
                    <span>Issued: {format(new Date(invoice.issueDate), 'MMM d, yyyy')}</span>
                  )}
                  {invoice.dueDate && (
                    <span>Due: {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</span>
                  )}
                  {invoice.paymentTerms && <span>Terms: {invoice.paymentTerms.replace(/_/g, ' ')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                {canPay && (
                  <Link
                    href={`/invoices/pay?invoiceId=${invoice.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    <CreditCard className="h-4 w-4" />
                    Pay Now
                  </Link>
                )}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs text-muted-foreground">Balance Due</p>
                <p
                  className={clsx(
                    'mt-1 text-2xl font-bold',
                    invoice.balanceDue > 0 ? 'text-destructive' : 'text-green-600'
                  )}
                >
                  ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs text-muted-foreground">Payments Made</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {invoice.payments.length}
                </p>
              </div>
            </div>

            {invoice.clientPO && (
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="text-xs text-muted-foreground">Client PO</p>
                <p className="mt-1 text-sm font-medium text-foreground">{invoice.clientPO}</p>
              </div>
            )}

            {/* Line Items */}
            <div className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                        Description
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                        Qty
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                        Unit Price
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                        Discount
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3 text-sm text-foreground">
                          {item.description}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                          {item.quantity}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-muted-foreground">
                          {item.discount > 0 ? `-$${item.discount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                          ${item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-border px-5 py-4">
                <div className="ml-auto max-w-xs space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-green-600">-${invoice.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="text-foreground">${invoice.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.rushSurcharge > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rush Surcharge</span>
                      <span className="text-foreground">${invoice.rushSurcharge.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">${invoice.total.toFixed(2)}</span>
                  </div>
                  {invoice.balanceDue !== invoice.total && (
                    <div className="flex justify-between text-base font-semibold">
                      <span className="text-foreground">Balance Due</span>
                      <span className={invoice.balanceDue > 0 ? 'text-destructive' : 'text-green-600'}>
                        ${invoice.balanceDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="rounded-lg border border-border bg-white p-5">
                <h2 className="text-sm font-semibold text-foreground">Notes</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {invoice.notes}
                </p>
              </div>
            )}

            {/* Payment History */}
            <div className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  Payment History ({invoice.payments.length})
                </h2>
              </div>
              {invoice.payments.length === 0 ? (
                <div className="p-8 text-center">
                  <DollarSign className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invoice.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-full',
                            payment.status === 'COMPLETED' ? 'bg-green-100' : 'bg-muted'
                          )}
                        >
                          {payment.status === 'COMPLETED' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.method.replace(/_/g, ' ')} &middot;{' '}
                            {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'text-xs font-medium',
                          payment.status === 'COMPLETED' ? 'text-green-600' : 'text-muted-foreground'
                        )}
                      >
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pay now CTA */}
            {canPay && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-primary" />
                <h3 className="mt-2 text-base font-semibold text-foreground">
                  Ready to pay?
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pay your outstanding balance of{' '}
                  <span className="font-semibold">
                    ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>{' '}
                  securely online.
                </p>
                <Link
                  href={`/invoices/pay?invoiceId=${invoice.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <CreditCard className="h-4 w-4" />
                  Pay Now
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
