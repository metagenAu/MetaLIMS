import React from 'react';

export interface PaymentReceivedEmailProps {
  clientName: string;
  invoiceNumber: string;
  amountPaid: string;
  paymentMethod: string;
  remainingBalance: string;
  portalUrl: string;
  labName: string;
}

export const PaymentReceivedEmail: React.FC<PaymentReceivedEmailProps> = ({
  clientName,
  invoiceNumber,
  amountPaid,
  paymentMethod,
  remainingBalance,
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
        .success-box { background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 16px 0; }
        .info-row { margin: 4px 0; }
        .info-label { font-weight: bold; color: #475569; }
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
          <h2>Payment Received</h2>
          <p>Dear {clientName},</p>
          <p>Thank you! We have received your payment.</p>
          <div className="success-box">
            <div className="info-row">
              <span className="info-label">Invoice:</span> {invoiceNumber}
            </div>
            <div className="info-row">
              <span className="info-label">Amount Paid:</span> {amountPaid}
            </div>
            <div className="info-row">
              <span className="info-label">Payment Method:</span> {paymentMethod}
            </div>
            <div className="info-row">
              <span className="info-label">Remaining Balance:</span> {remainingBalance}
            </div>
          </div>
          <p style={{ textAlign: 'center', margin: '24px 0' }}>
            <a href={portalUrl} className="btn">
              View Payment History
            </a>
          </p>
        </div>
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} {labName}. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
);

export function getPaymentReceivedSubject(invoiceNumber: string): string {
  return `Payment Received - Invoice ${invoiceNumber}`;
}
