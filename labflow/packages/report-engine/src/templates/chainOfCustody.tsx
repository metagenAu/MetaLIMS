import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#1e40af',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f1f5f9',
    padding: 4,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  label: {
    width: 130,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  value: {
    flex: 1,
    color: '#1e293b',
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    padding: 5,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottom: '0.5px solid #e2e8f0',
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLine: {
    borderTop: '1px solid #1e293b',
    paddingTop: 4,
    marginTop: 40,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#475569',
  },
});

export interface ChainOfCustodyData {
  lab: {
    name: string;
    address: string;
    phone: string;
  };
  sample: {
    sampleNumber: string;
    name: string;
    matrix: string;
    barcodeValue: string;
    collectedDate?: string;
    collectedBy?: string;
    collectionLocation?: string;
  };
  order: {
    orderNumber: string;
    clientName: string;
  };
  entries: Array<{
    action: string;
    fromLocation?: string;
    toLocation?: string;
    performedBy: string;
    performedAt: string;
    temperature?: string;
    notes?: string;
  }>;
}

export const ChainOfCustodyPDF: React.FC<{ data: ChainOfCustodyData }> = ({ data }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.title}>Chain of Custody Record</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sample Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Sample Number:</Text>
          <Text style={styles.value}>{data.sample.sampleNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sample Name:</Text>
          <Text style={styles.value}>{data.sample.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Matrix:</Text>
          <Text style={styles.value}>{data.sample.matrix}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Barcode:</Text>
          <Text style={styles.value}>{data.sample.barcodeValue}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Work Order:</Text>
          <Text style={styles.value}>{data.order.orderNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Client:</Text>
          <Text style={styles.value}>{data.order.clientName}</Text>
        </View>
        {data.sample.collectedDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Date Collected:</Text>
            <Text style={styles.value}>{data.sample.collectedDate}</Text>
          </View>
        )}
        {data.sample.collectedBy && (
          <View style={styles.row}>
            <Text style={styles.label}>Collected By:</Text>
            <Text style={styles.value}>{data.sample.collectedBy}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custody Log</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Date/Time</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Action</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%' }]}>From</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%' }]}>To</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Performed By</Text>
            <Text style={[styles.tableHeaderCell, { width: '8%' }]}>Temp</Text>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Notes</Text>
          </View>
          {data.entries.map((entry, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '15%' }]}>
                {entry.performedAt}
              </Text>
              <Text style={[styles.tableCell, { width: '15%' }]}>{entry.action}</Text>
              <Text style={[styles.tableCell, { width: '15%' }]}>
                {entry.fromLocation || '—'}
              </Text>
              <Text style={[styles.tableCell, { width: '15%' }]}>
                {entry.toLocation || '—'}
              </Text>
              <Text style={[styles.tableCell, { width: '12%' }]}>
                {entry.performedBy}
              </Text>
              <Text style={[styles.tableCell, { width: '8%' }]}>
                {entry.temperature ? `${entry.temperature}°C` : '—'}
              </Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>
                {entry.notes || '—'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Relinquished By (Signature / Date)</Text>
          </View>
        </View>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            <Text style={styles.signatureLabel}>Received By (Signature / Date)</Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);
