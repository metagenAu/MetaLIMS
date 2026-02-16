'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Star,
  DollarSign,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import PortalLayout from '@/components/PortalLayout';
import { usePortalPaymentMethods, usePortalPaymentHistory } from '@/hooks/usePortalApi';

const CARD_BRAND_COLORS: Record<string, string> = {
  visa: 'bg-blue-600',
  mastercard: 'bg-red-500',
  amex: 'bg-blue-800',
  discover: 'bg-orange-500',
  default: 'bg-gray-600',
};

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'methods' | 'history'>('methods');
  const [page, setPage] = useState(1);

  const {
    data: paymentMethods,
    isLoading: loadingMethods,
    error: methodsError,
    refetch: refetchMethods,
  } = usePortalPaymentMethods();

  const {
    data: paymentHistory,
    isLoading: loadingHistory,
    error: historyError,
    refetch: refetchHistory,
  } = usePortalPaymentHistory({ page, pageSize: 20 });

  return (
    <PortalLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Payments</h1>
          <p className="text-sm text-muted-foreground">
            Manage your payment methods and view payment history.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          <button
            onClick={() => setActiveTab('methods')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'methods'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Payment Methods
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Payment History
          </button>
        </div>

        {/* Payment Methods Tab */}
        {activeTab === 'methods' && (
          <>
            {loadingMethods && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Loading payment methods...
                  </p>
                </div>
              </div>
            )}

            {methodsError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-2 text-sm font-medium text-destructive">
                  Failed to load payment methods
                </p>
                <button
                  onClick={() => refetchMethods()}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}

            {paymentMethods && (
              <div className="space-y-4">
                {paymentMethods.length === 0 ? (
                  <div className="rounded-lg border border-border bg-white p-12 text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/40" />
                    <h3 className="mt-4 text-base font-medium text-foreground">
                      No payment methods
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a payment method to streamline future payments.
                    </p>
                    <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      <Plus className="h-4 w-4" />
                      Add Payment Method
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paymentMethods.map((method) => {
                        const brandColor =
                          CARD_BRAND_COLORS[method.brand.toLowerCase()] ||
                          CARD_BRAND_COLORS.default;
                        return (
                          <div
                            key={method.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-white p-4"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={clsx(
                                  'flex h-10 w-14 items-center justify-center rounded-md text-white',
                                  brandColor
                                )}
                              >
                                <span className="text-xs font-bold uppercase">
                                  {method.brand}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">
                                    {method.type === 'card' ? 'Card' : method.type} ending in{' '}
                                    {method.last4}
                                  </p>
                                  {method.isDefault && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                      <Star className="h-3 w-3" />
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Expires {method.expiryMonth.toString().padStart(2, '0')}/
                                  {method.expiryYear}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!method.isDefault && (
                                <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                                  Set Default
                                </button>
                              )}
                              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                      <Plus className="h-4 w-4" />
                      Add Payment Method
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Payment History Tab */}
        {activeTab === 'history' && (
          <>
            {loadingHistory && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Loading payment history...
                  </p>
                </div>
              </div>
            )}

            {historyError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-2 text-sm font-medium text-destructive">
                  Failed to load payment history
                </p>
                <button
                  onClick={() => refetchHistory()}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}

            {paymentHistory && paymentHistory.data.length === 0 && (
              <div className="rounded-lg border border-border bg-white p-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-4 text-base font-medium text-foreground">
                  No payment history
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your payment history will appear here once payments are made.
                </p>
              </div>
            )}

            {paymentHistory && paymentHistory.data.length > 0 && (
              <>
                <div className="overflow-hidden rounded-lg border border-border bg-white">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                          Date
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                          Invoice
                        </th>
                        <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground sm:table-cell">
                          Method
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                          Status
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paymentHistory.data.map((payment) => (
                        <tr key={payment.id} className="hover:bg-muted/30">
                          <td className="px-5 py-3 text-sm text-muted-foreground">
                            {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                          </td>
                          <td className="px-5 py-3">
                            {payment.invoiceNumber ? (
                              <Link
                                href={`/invoices/${payment.invoiceId}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {payment.invoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="hidden px-5 py-3 text-sm text-muted-foreground sm:table-cell">
                            {payment.method.replace(/_/g, ' ')}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                payment.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-700'
                                  : payment.status === 'PENDING'
                                    ? 'bg-amber-100 text-amber-700'
                                    : payment.status === 'FAILED'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700'
                              )}
                            >
                              {payment.status === 'COMPLETED' && (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-medium text-foreground">
                            ${payment.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {paymentHistory.totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(paymentHistory.page - 1) * paymentHistory.pageSize + 1} to{' '}
                      {Math.min(
                        paymentHistory.page * paymentHistory.pageSize,
                        paymentHistory.total
                      )}{' '}
                      of {paymentHistory.total} payments
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(page - 1)}
                        disabled={page <= 1}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(page + 1)}
                        disabled={page >= paymentHistory.totalPages}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
