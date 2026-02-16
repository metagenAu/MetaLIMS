import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 4,
    fontSize: 7,
    fontFamily: 'Helvetica',
  },
  label: {
    border: '1px solid #000',
    padding: 6,
    width: '100%',
    height: 144, // 2 inches at 72 dpi
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  labName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  sampleNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  infoLabel: {
    width: 50,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
  },
  infoValue: {
    flex: 1,
    fontSize: 6,
  },
  barcodeArea: {
    alignItems: 'center',
    marginTop: 4,
  },
  barcodeText: {
    fontSize: 6,
    textAlign: 'center',
    marginTop: 2,
  },
});

export interface SampleLabelData {
  labName: string;
  sampleNumber: string;
  clientName: string;
  orderNumber: string;
  matrix: string;
  receivedDate: string;
  storageCondition?: string;
  barcodeValue: string;
  barcodeImageBase64?: string;
}

export const SampleLabel: React.FC<{ data: SampleLabelData }> = ({ data }) => (
  <Document>
    <Page size={[288, 144]} style={styles.page}>
      <View style={styles.label}>
        <View style={styles.topRow}>
          <Text style={styles.labName}>{data.labName}</Text>
          <Text style={{ fontSize: 6 }}>{data.receivedDate}</Text>
        </View>

        <Text style={styles.sampleNumber}>{data.sampleNumber}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Client:</Text>
          <Text style={styles.infoValue}>{data.clientName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Order:</Text>
          <Text style={styles.infoValue}>{data.orderNumber}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Matrix:</Text>
          <Text style={styles.infoValue}>{data.matrix}</Text>
        </View>
        {data.storageCondition && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Storage:</Text>
            <Text style={styles.infoValue}>{data.storageCondition}</Text>
          </View>
        )}

        <View style={styles.barcodeArea}>
          {data.barcodeImageBase64 && (
            <Image
              src={`data:image/png;base64,${data.barcodeImageBase64}`}
              style={{ width: 180, height: 30 }}
            />
          )}
          <Text style={styles.barcodeText}>{data.barcodeValue}</Text>
        </View>
      </View>
    </Page>
  </Document>
);
