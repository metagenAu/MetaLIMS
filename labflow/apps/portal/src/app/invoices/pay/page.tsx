'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import { usePortalInvoice, useCreatePaymentIntent } from '@/hooks/usePortalApi';

export default function PayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get('invoiceId') || '';
  const { data: invoice, isLoading: loadingInvoice } = usePortalInvoice(invoiceId);
  const createPayment = useCreatePaymentIntent();

  const [paymentState, setPaymentState] = useState<'form' | 'processing' | 'success' | 'error'>(
    'form'
  );
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function formatCardNumber(value: string): string {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ').substring(0, 19) : '';
  }

  function formatExpiry(value: string): string {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      setErrorMessage('Please enter a valid card number.');
      return;
    }
    if (!cardExpiry || cardExpiry.length < 5) {
      setErrorMessage('Please enter a valid expiry date.');
      return;
    }
    if (!cardCvc || cardCvc.length < 3) {
      setErrorMessage('Please enter a valid CVC.');
      return;
    }
    if (!cardName) {
      setErrorMessage('Please enter the cardholder name.');
      return;
    }

    setPaymentState('processing');

    try {
      await createPayment.mutateAsync(invoiceId);
      setPaymentState('success');
    } catch (err: any) {
      setPaymentState('error');
      setErrorMessage(
        err?.response?.data?.message || 'Payment failed. Please try again or use a different card.'
      );
    }
  }

  if (!invoiceId) {
    return (
      <PortalLayout>
        <div className="mx-auto max-w-lg py-20 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No Invoice Selected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please select an invoice to pay from your invoices page.
          </p>
          <Link
            href="/invoices"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Invoices
          </Link>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/invoices/${invoiceId}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoice
          </Link>
        </div>

        {loadingInvoice && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading payment details...</p>
            </div>
          </div>
        )}

        {paymentState === 'success' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Payment Successful</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment has been processed successfully. You will receive a confirmation email
              shortly.
            </p>
            {invoice && (
              <p className="mt-2 text-sm font-medium text-foreground">
                Amount: ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href={`/invoices/${invoiceId}`}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                View Invoice
              </Link>
              <Link
                href="/"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

        {invoice && paymentState !== 'success' && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pay Invoice</h1>
              <p className="text-sm text-muted-foreground">
                Securely pay invoice {invoice.invoiceNumber}
              </p>
            </div>

            {/* Amount summary */}
            <div className="rounded-lg border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice {invoice.invoiceNumber}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance due</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            {/* Payment form */}
            <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-foreground">Secure Payment</span>
              </div>

              {(errorMessage || paymentState === 'error') && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMessage || 'Payment failed. Please try again.'}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Card Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <CreditCard className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      value={cardCvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 4))}
                      maxLength={4}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={paymentState === 'processing'}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paymentState === 'processing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing payment...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Pay ${invoice.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>Payments are processed securely via Stripe</span>
              </div>
            </form>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
