import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '2px solid #1e40af',
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
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
  reportTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#1e3a5f',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f1f5f9',
    padding: 4,
    marginBottom: 6,
    color: '#1e3a5f',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    width: 120,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  value: {
    flex: 1,
    color: '#1e293b',
  },
  table: {
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    padding: 4,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottom: '0.5px solid #e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 4,
    borderBottom: '0.5px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
  },
  pass: {
    color: '#16a34a',
    fontFamily: 'Helvetica-Bold',
  },
  fail: {
    color: '#dc2626',
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1px solid #e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  signatureBlock: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureLine: {
    width: 200,
    borderTop: '1px solid #1e293b',
    paddingTop: 4,
    marginTop: 30,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#475569',
  },
  disclaimer: {
    marginTop: 15,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderLeft: '2px solid #94a3b8',
  },
  disclaimerText: {
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.4,
  },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    fontSize: 60,
    color: '#e2e8f0',
    opacity: 0.3,
    transform: 'rotate(-45deg)',
  },
});

export interface CoAData {
  lab: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
    licenseNumber: string;
    accreditations: string[];
    logoUrl?: string;
  };
  report: {
    reportNumber: string;
    version: number;
    isAmended: boolean;
    generatedDate: string;
    approvedDate?: string;
    approvedBy?: string;
  };
  client: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    contactName: string;
  };
  order: {
    orderNumber: string;
    receivedDate: string;
    completedDate?: string;
    clientPO?: string;
  };
  samples: Array<{
    sampleNumber: string;
    name: string;
    matrix: string;
    collectedDate?: string;
    receivedDate: string;
    tests: Array<{
      methodName: string;
      methodCode: string;
      results: Array<{
        analyteName: string;
        finalValue: string;
        unit: string;
        qualifier?: string;
        specLimit?: string;
        passStatus?: string;
      }>;
      overallResult: string;
    }>;
  }>;
}

const colWidths = {
  analyte: '30%',
  result: '15%',
  unit: '12%',
  qualifier: '10%',
  limit: '18%',
  status: '15%',
};

export const CoACertificate: React.FC<{ data: CoAData }> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {data.report.isAmended && <Text style={styles.watermark}>AMENDED</Text>}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.labName}>{data.lab.name}</Text>
          <Text style={styles.labInfo}>{data.lab.address}</Text>
          <Text style={styles.labInfo}>
            {data.lab.city}, {data.lab.state} {data.lab.zip}
          </Text>
          <Text style={styles.labInfo}>Phone: {data.lab.phone}</Text>
          <Text style={styles.labInfo}>License: {data.lab.licenseNumber}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.labInfo}>Report #: {data.report.reportNumber}</Text>
          <Text style={styles.labInfo}>Version: {data.report.version}</Text>
          <Text style={styles.labInfo}>Date: {data.report.generatedDate}</Text>
          <Text style={styles.labInfo}>
            Accreditations: {data.lab.accreditations.join(', ')}
          </Text>
        </View>
      </View>

      <Text style={styles.reportTitle}>Certificate of Analysis</Text>

      {/* Client Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Client:</Text>
          <Text style={styles.value}>{data.client.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Address:</Text>
          <Text style={styles.value}>
            {data.client.address}, {data.client.city}, {data.client.state}{' '}
            {data.client.zip}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Contact:</Text>
          <Text style={styles.value}>{data.client.contactName}</Text>
        </View>
      </View>

      {/* Order Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Work Order:</Text>
          <Text style={styles.value}>{data.order.orderNumber}</Text>
        </View>
        {data.order.clientPO && (
          <View style={styles.row}>
            <Text style={styles.label}>Client PO:</Text>
            <Text style={styles.value}>{data.order.clientPO}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Date Received:</Text>
          <Text style={styles.value}>{data.order.receivedDate}</Text>
        </View>
        {data.order.completedDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Date Completed:</Text>
            <Text style={styles.value}>{data.order.completedDate}</Text>
          </View>
        )}
      </View>

      {/* Results per Sample */}
      {data.samples.map((sample, sIndex) => (
        <View key={sIndex} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>
            Sample: {sample.sampleNumber} — {sample.name}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>Matrix:</Text>
            <Text style={styles.value}>{sample.matrix}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date Collected:</Text>
            <Text style={styles.value}>{sample.collectedDate || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date Received:</Text>
            <Text style={styles.value}>{sample.receivedDate}</Text>
          </View>

          {sample.tests.map((test, tIndex) => (
            <View key={tIndex} style={{ marginTop: 8 }}>
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: 'Helvetica-Bold',
                  marginBottom: 4,
                  color: '#334155',
                }}
              >
                {test.methodName} ({test.methodCode}) — Overall:{' '}
                <Text style={test.overallResult === 'PASS' ? styles.pass : styles.fail}>
                  {test.overallResult}
                </Text>
              </Text>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.analyte }]}>
                    Analyte
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.result }]}>
                    Result
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.unit }]}>
                    Unit
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.qualifier }]}>
                    Qualifier
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.limit }]}>
                    Spec Limit
                  </Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.status }]}>
                    Status
                  </Text>
                </View>
                {test.results.map((result, rIndex) => (
                  <View
                    key={rIndex}
                    style={rIndex % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  >
                    <Text style={[styles.tableCell, { width: colWidths.analyte }]}>
                      {result.analyteName}
                    </Text>
                    <Text style={[styles.tableCell, { width: colWidths.result }]}>
                      {result.finalValue}
                    </Text>
                    <Text style={[styles.tableCell, { width: colWidths.unit }]}>
                      {result.unit}
                    </Text>
                    <Text style={[styles.tableCell, { width: colWidths.qualifier }]}>
                      {result.qualifier || '—'}
                    </Text>
                    <Text style={[styles.tableCell, { width: colWidths.limit }]}>
                      {result.specLimit || '—'}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: colWidths.status },
                        result.passStatus === 'PASS' ? styles.pass : result.passStatus === 'FAIL' ? styles.fail : {},
                      ]}
                    >
                      {result.passStatus || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          This report shall not be reproduced except in full, without the written approval of{' '}
          {data.lab.name}. The results in this report relate only to the items tested. This
          report must not be used by the client to claim product endorsement by any
          accreditation body. Results are reported on an &quot;as received&quot; basis unless
          otherwise noted. Measurement uncertainty is available upon request.
        </Text>
      </View>

      {/* Signature Block */}
      <View style={styles.signatureBlock}>
        <View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Laboratory Director</Text>
            {data.report.approvedBy && (
              <Text style={{ fontSize: 8, marginTop: 2 }}>{data.report.approvedBy}</Text>
            )}
          </View>
        </View>
        <View>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Date Approved</Text>
            {data.report.approvedDate && (
              <Text style={{ fontSize: 8, marginTop: 2 }}>{data.report.approvedDate}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          {data.lab.name} — {data.lab.licenseNumber}
        </Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  </Document>
);
