import React from 'react';

export interface WelcomeClientEmailProps {
  clientName: string;
  contactName: string;
  portalUrl: string;
  loginEmail: string;
  labName: string;
  labPhone: string;
}

export const WelcomeClientEmail: React.FC<WelcomeClientEmailProps> = ({
  clientName,
  contactName,
  portalUrl,
  loginEmail,
  labName,
  labPhone,
}) => (
  <html>
    <head>
      <style>{`
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background-color: #1e40af; padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
        .header p { color: #bfdbfe; margin: 8px 0 0; }
        .content { padding: 32px 24px; }
        .content h2 { color: #1e293b; margin-top: 0; }
        .feature-list { margin: 16px 0; }
        .feature { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .feature-icon { color: #16a34a; font-weight: bold; margin-right: 8px; }
        .info-box { background-color: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .btn { display: inline-block; background-color: #1e40af; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
        .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
      `}</style>
    </head>
    <body>
      <div className="container">
        <div className="header">
          <h1>Welcome to {labName}</h1>
          <p>Your client portal is ready</p>
        </div>
        <div className="content">
          <h2>Hello {contactName},</h2>
          <p>
            Welcome! Your account for <strong>{clientName}</strong> has been created. You now
            have access to our client portal where you can:
          </p>
          <div className="feature-list">
            <div className="feature">
              <span className="feature-icon">&#10003;</span>
              Submit new orders and track samples in real-time
            </div>
            <div className="feature">
              <span className="feature-icon">&#10003;</span>
              Download Certificates of Analysis (CoA) as soon as they are approved
            </div>
            <div className="feature">
              <span className="feature-icon">&#10003;</span>
              View and pay invoices online
            </div>
            <div className="feature">
              <span className="feature-icon">&#10003;</span>
              Manage your team and account settings
            </div>
          </div>
          <div className="info-box">
            <p style={{ margin: '0 0 4px' }}>
              <strong>Login Email:</strong> {loginEmail}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              You will receive a separate email to set your password.
            </p>
          </div>
          <p style={{ textAlign: 'center', margin: '24px 0' }}>
            <a href={portalUrl} className="btn">
              Access Client Portal
            </a>
          </p>
          <p>
            If you need any assistance, please contact us at {labPhone}.
          </p>
        </div>
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} {labName}. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
);

export function getWelcomeClientSubject(labName: string): string {
  return `Welcome to ${labName} - Your Portal Access`;
}
