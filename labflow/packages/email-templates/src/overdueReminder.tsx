import React from 'react';

export interface OverdueReminderEmailProps {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  portalUrl: string;
  labName: string;
}

export const OverdueReminderEmail: React.FC<OverdueReminderEmailProps> = ({
  clientName,
  invoiceNumber,
  amount,
  dueDate,
  daysOverdue,
  portalUrl,
  labName,
}) => (
  <html>
    <head>
      <style>{`
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background-color: #dc2626; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .content { padding: 32px 24px; }
        .content h2 { color: #1e293b; margin-top: 0; }
        .warning-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; }
        .overdue-badge { display: inline-block; background-color: #dc2626; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; }
        .info-row { margin: 4px 0; }
        .info-label { font-weight: bold; color: #475569; }
        .btn { display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>Payment Reminder</h1>
        </div>
        <div className="content">
          <h2>Invoice Overdue</h2>
          <p>Dear {clientName},</p>
          <p>
            This is a reminder that the following invoice is now{' '}
            <span className="overdue-badge">{daysOverdue} days overdue</span>.
          </p>
          <div className="warning-box">
            <div className="info-row">
              <span className="info-label">Invoice:</span> {invoiceNumber}
            </div>
            <div className="info-row">
              <span className="info-label">Amount Due:</span> {amount}
            </div>
            <div className="info-row">
              <span className="info-label">Original Due Date:</span> {dueDate}
            </div>
            <div className="info-row">
              <span className="info-label">Days Overdue:</span> {daysOverdue}
            </div>
          </div>
          <p>Please arrange payment at your earliest convenience.</p>
          <p style={{ textAlign: 'center', margin: '24px 0' }}>
            <a href={portalUrl} className="btn">
              Pay Now
            </a>
          </p>
          <p style={{ fontSize: '12px', color: '#64748b' }}>
            If you have already made this payment, please disregard this notice.
            For questions about this invoice, please contact our billing department.
          </p>
        </div>
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} {labName}. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
);

export function getOverdueReminderSubject(invoiceNumber: string, daysOverdue: number): string {
  return `OVERDUE: Invoice ${invoiceNumber} - ${daysOverdue} days past due`;
}
