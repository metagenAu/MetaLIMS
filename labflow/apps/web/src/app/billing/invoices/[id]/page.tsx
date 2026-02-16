'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Send, DollarSign, Printer } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatCurrency } from '@/lib/formatters';

const fallbackInvoice = {
  id: 'i1',
  invoiceNumber: 'INV-2024-0156',
  clientName: 'Acme Environmental',
  clientId: 'c1',
  clientEmail: 'billing@acme-env.com',
  status: 'overdue',
  totalAmount: 5200,
  paidAmount: 0,
  balanceDue: 5200,
  issueDate: '2024-01-08T00:00:00Z',
  dueDate: '2024-02-08T00:00:00Z',
  paidDate: null,
  notes: 'Quarterly monitoring - Site A',
  lineItems: [
    { id: 'li1', description: 'Heavy Metals Analysis (ICP-MS) x 5 samples', quantity: 5, unitPrice: 350, amount: 1750 },
    { id: 'li2', description: 'VOCs Analysis (EPA 8260) x 5 samples', quantity: 5, unitPrice: 275, amount: 1375 },
    { id: 'li3', description: 'Microbiology (Total Coliform, E.coli) x 5 samples', quantity: 5, unitPrice: 180, amount: 900 },
    { id: 'li4', description: 'General Chemistry (pH, Conductivity, Turbidity) x 5', quantity: 5, unitPrice: 75, amount: 375 },
    { id: 'li5', description: 'Rush processing surcharge', quantity: 1, unitPrice: 800, amount: 800 },
  ],
  payments: [
  ],
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoice = fallbackInvoice;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/billing/invoices" className="inline-flex items-center justify-center rounded-md border bg-background p-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
                <StatusBadge status={invoice.status} />
              </div>
              <p className="text-muted-foreground mt-1">
                <Link href={`/clients/${invoice.clientId}`} className="text-primary hover:underline">{invoice.clientName}</Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Send className="h-4 w-4" />
              Send
            </button>
            {invoice.balanceDue > 0 && (
              <Link
                href="/billing/payments"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <DollarSign className="h-4 w-4" />
                Record Payment
              </Link>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Issue Date</p>
            <p className="text-sm font-medium mt-1">{formatDate(invoice.issueDate)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="text-sm font-medium mt-1 text-destructive">{formatDate(invoice.dueDate)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-sm font-medium mt-1">{formatCurrency(invoice.totalAmount)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className="text-sm font-bold mt-1 text-destructive">{formatCurrency(invoice.balanceDue)}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-medium">Line Items</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-center font-medium w-20">Qty</th>
                <th className="px-4 py-2 text-right font-medium w-28">Unit Price</th>
                <th className="px-4 py-2 text-right font-medium w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-center">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={3} className="px-4 py-2 text-right font-medium">Subtotal</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(invoice.totalAmount)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Paid</td>
                <td className="px-4 py-2 text-right">{formatCurrency(invoice.paidAmount)}</td>
              </tr>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-4 py-2 text-right font-bold">Balance Due</td>
                <td className="px-4 py-2 text-right font-bold text-destructive">{formatCurrency(invoice.balanceDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">Notes</h3>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
