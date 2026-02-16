import React from 'react';

export interface InvoiceSentEmailProps {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  paymentTerms: string;
  portalUrl: string;
  labName: string;
}

export const InvoiceSentEmail: React.FC<InvoiceSentEmailProps> = ({
  clientName,
  invoiceNumber,
  amount,
  dueDate,
  paymentTerms,
  portalUrl,
  labName,
}) => (
  <html>
    <head>
      <style>{`
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background-color: #1e40af; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .content { padding: 32px 24px; }
        .content h2 { color: #1e293b; margin-top: 0; }
        .invoice-box { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center; }
        .amount { font-size: 32px; font-weight: bold; color: #1e40af; margin: 8px 0; }
        .info-row { margin: 4px 0; color: #475569; }
        .info-label { font-weight: bold; }
        .btn { display: inline-block; background-color: #1e40af; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>{labName}</h1>
        </div>
        <div className="content">
          <h2>Invoice {invoiceNumber}</h2>
          <p>Dear {clientName},</p>
          <p>Please find your invoice details below.</p>
          <div className="invoice-box">
            <div className="info-row">Invoice #{invoiceNumber}</div>
            <div className="amount">{amount}</div>
            <div className="info-row">
              <span className="info-label">Due Date:</span> {dueDate}
            </div>
            <div className="info-row">
              <span className="info-label">Terms:</span> {paymentTerms}
            </div>
          </div>
          <p style={{ textAlign: 'center', margin: '24px 0' }}>
            <a href={portalUrl} className="btn">
              View & Pay Invoice
            </a>
          </p>
          <p>
            You can view the full invoice details and make a payment through our client portal.
          </p>
        </div>
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} {labName}. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
);

export function getInvoiceSentSubject(invoiceNumber: string): string {
  return `Invoice ${invoiceNumber} from LabFlow`;
}
