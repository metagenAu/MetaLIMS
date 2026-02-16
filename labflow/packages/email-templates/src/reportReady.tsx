import React from 'react';

export interface ReportReadyEmailProps {
  clientName: string;
  orderNumber: string;
  reportNumber: string;
  sampleCount: number;
  portalUrl: string;
  labName: string;
}

export const ReportReadyEmail: React.FC<ReportReadyEmailProps> = ({
  clientName,
  orderNumber,
  reportNumber,
  sampleCount,
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
        .btn { display: inline-block; background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>{labName}</h1>
        </div>
        <div className="content">
          <h2>Your Report is Ready</h2>
          <p>Dear {clientName},</p>
          <p>
            Great news! The Certificate of Analysis for your order has been completed and is
            ready for download.
          </p>
          <div className="success-box">
            <div className="info-row">
              <span className="info-label">Report Number:</span> {reportNumber}
            </div>
            <div className="info-row">
              <span className="info-label">Work Order:</span> {orderNumber}
            </div>
            <div className="info-row">
              <span className="info-label">Samples Analyzed:</span> {sampleCount}
            </div>
          </div>
          <p style={{ textAlign: 'center', margin: '24px 0' }}>
            <a href={portalUrl} className="btn">
              Download Report
            </a>
          </p>
          <p>
            You can access all your reports anytime through the client portal.
          </p>
        </div>
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} {labName}. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
);

export function getReportReadySubject(reportNumber: string): string {
  return `Report Ready - ${reportNumber}`;
}
