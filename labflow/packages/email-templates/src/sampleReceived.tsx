import React from 'react';

export interface SampleReceivedEmailProps {
  clientName: string;
  orderNumber: string;
  sampleCount: number;
  receivedDate: string;
  estimatedCompletionDate: string;
  portalUrl: string;
  labName: string;
}

export const SampleReceivedEmail: React.FC<SampleReceivedEmailProps> = ({
  clientName,
  orderNumber,
  sampleCount,
  receivedDate,
  estimatedCompletionDate,
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
        .info-box { background-color: #eff6ff; border-left: 4px solid #1e40af; padding: 16px; margin: 16px 0; }
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
          <h2>Samples Received</h2>
          <p>Dear {clientName},</p>
          <p>
            We are writing to confirm that your samples have been received at our laboratory
            and are being processed.
          </p>
          <div className="info-box">
            <div className="info-row">
              <span className="info-label">Work Order:</span> {orderNumber}
            </div>
            <div className="info-row">
              <span className="info-label">Samples Received:</span> {sampleCount}
            </div>
            <div className="info-row">
              <span className="info-label">Date Received:</span> {receivedDate}
            </div>
            <div className="info-row">
              <span className="info-label">Estimated Completion:</span>{' '}
              {estimatedCompletionDate}
            </div>
          </div>
          <p>
            You can track the progress of your samples in real-time through our client portal.
          </p>
          <p style={{ textAlign: 'center', margin: '24px 0' }}>
            <a href={portalUrl} className="btn">
              View Order Status
            </a>
          </p>
          <p>
            If you have any questions, please don&apos;t hesitate to contact us.
          </p>
        </div>
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} {labName}. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
);

export function getSampleReceivedSubject(orderNumber: string): string {
  return `Samples Received - Order ${orderNumber}`;
}
