import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  headerLeft: {
    flex: 1,
  },
  labName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  labInfo: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 1,
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 10,
    textAlign: 'right',
    color: '#475569',
    marginTop: 4,
  },
  divider: {
    borderBottom: '2px solid #1e40af',
    marginBottom: 20,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  infoBlock: {
    width: '45%',
  },
  infoLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 9,
    color: '#1e293b',
    marginBottom: 1,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  detailLabel: {
    width: 80,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  detailValue: {
    fontSize: 9,
    color: '#1e293b',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    padding: 6,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5px solid #e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    width: 250,
    justifyContent: 'space-between',
    marginBottom: 3,
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 9,
    color: '#475569',
  },
  totalValue: {
    fontSize: 9,
    color: '#1e293b',
  },
  grandTotalRow: {
    flexDirection: 'row',
    width: 250,
    justifyContent: 'space-between',
    borderTop: '2px solid #1e40af',
    paddingTop: 6,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
  },
  balanceDueRow: {
    flexDirection: 'row',
    width: 250,
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    padding: 6,
    marginTop: 6,
  },
  balanceDueLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
  },
  balanceDueValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
  },
  notesSection: {
    marginTop: 25,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderLeft: '2px solid #94a3b8',
  },
  notesTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.4,
  },
  paymentInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#eff6ff',
    borderLeft: '2px solid #1e40af',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
});

export interface InvoicePDFData {
  lab: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
  };
  invoice: {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    clientPO?: string;
    paymentTerms: string;
  };
  client: {
    name: string;
    billingAddress: string;
    billingCity: string;
    billingState: string;
    billingZip: string;
    billingEmail: string;
  };
  lineItems: Array<{
    description: string;
    sampleCount: number;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount: number;
  rushSurcharge: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  balanceDue: number;
  notes?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const itemColWidths = {
  description: '40%',
  samples: '10%',
  quantity: '10%',
  unitPrice: '15%',
  discount: '10%',
  total: '15%',
};

export const InvoicePDF: React.FC<{ data: InvoicePDFData }> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.labName}>{data.lab.name}</Text>
          <Text style={styles.labInfo}>{data.lab.address}</Text>
          <Text style={styles.labInfo}>
            {data.lab.city}, {data.lab.state} {data.lab.zip}
          </Text>
          <Text style={styles.labInfo}>Phone: {data.lab.phone}</Text>
          <Text style={styles.labInfo}>Email: {data.lab.email}</Text>
        </View>
        <View>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <Text style={styles.invoiceNumber}>{data.invoice.invoiceNumber}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Bill To + Invoice Details */}
      <View style={styles.infoSection}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Bill To</Text>
          <Text style={styles.infoText}>{data.client.name}</Text>
          <Text style={styles.infoText}>{data.client.billingAddress}</Text>
          <Text style={styles.infoText}>
            {data.client.billingCity}, {data.client.billingState}{' '}
            {data.client.billingZip}
          </Text>
          <Text style={styles.infoText}>{data.client.billingEmail}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Invoice Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Issue Date:</Text>
            <Text style={styles.detailValue}>{data.invoice.issueDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>{data.invoice.dueDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Terms:</Text>
            <Text style={styles.detailValue}>{data.invoice.paymentTerms}</Text>
          </View>
          {data.invoice.clientPO && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Client PO:</Text>
              <Text style={styles.detailValue}>{data.invoice.clientPO}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Line Items Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: itemColWidths.description }]}>
            Description
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: itemColWidths.samples, textAlign: 'center' },
            ]}
          >
            Samples
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: itemColWidths.quantity, textAlign: 'center' },
            ]}
          >
            Qty
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: itemColWidths.unitPrice, textAlign: 'right' },
            ]}
          >
            Unit Price
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: itemColWidths.discount, textAlign: 'right' },
            ]}
          >
            Discount
          </Text>
          <Text
            style={[
              styles.tableHeaderCell,
              { width: itemColWidths.total, textAlign: 'right' },
            ]}
          >
            Total
          </Text>
        </View>
        {data.lineItems.map((item, index) => (
          <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={[styles.tableCell, { width: itemColWidths.description }]}>
              {item.description}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: itemColWidths.samples, textAlign: 'center' },
              ]}
            >
              {item.sampleCount}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: itemColWidths.quantity, textAlign: 'center' },
              ]}
            >
              {item.quantity}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: itemColWidths.unitPrice, textAlign: 'right' },
              ]}
            >
              {formatCurrency(item.unitPrice)}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: itemColWidths.discount, textAlign: 'right' },
              ]}
            >
              {item.discount > 0 ? formatCurrency(item.discount) : '—'}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { width: itemColWidths.total, textAlign: 'right' },
              ]}
            >
              {formatCurrency(item.total)}
            </Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(data.subtotal)}</Text>
        </View>
        {data.discountAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={styles.totalValue}>-{formatCurrency(data.discountAmount)}</Text>
          </View>
        )}
        {data.rushSurcharge > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Rush Surcharge</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.rushSurcharge)}</Text>
          </View>
        )}
        {data.taxAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Tax ({(data.taxRate * 100).toFixed(2)}%)
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(data.taxAmount)}</Text>
          </View>
        )}
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(data.total)}</Text>
        </View>
        {data.balanceDue > 0 && (
          <View style={styles.balanceDueRow}>
            <Text style={styles.balanceDueLabel}>Balance Due</Text>
            <Text style={styles.balanceDueValue}>{formatCurrency(data.balanceDue)}</Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {data.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Notes</Text>
          <Text style={styles.notesText}>{data.notes}</Text>
        </View>
      )}

      {/* Payment Info */}
      <View style={styles.paymentInfo}>
        <Text style={styles.notesTitle}>Payment Information</Text>
        <Text style={styles.notesText}>
          Please make payment by the due date. Payments can be made online through our client
          portal, by check, wire transfer, or credit card. For questions regarding this
          invoice, please contact our billing department.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          Thank you for your business — {data.lab.name}
        </Text>
      </View>
    </Page>
  </Document>
);
