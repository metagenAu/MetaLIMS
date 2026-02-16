import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { CoACertificate, type CoAData } from './templates/coa';
import { InvoicePDF, type InvoicePDFData } from './templates/invoice';
import { ChainOfCustodyPDF, type ChainOfCustodyData } from './templates/chainOfCustody';
import { SampleLabel, type SampleLabelData } from './templates/sampleLabel';

export type ReportTemplateType = 'coa' | 'invoice' | 'chain-of-custody' | 'sample-label';

export interface RenderResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export async function renderCoA(data: CoAData): Promise<RenderResult> {
  const element = React.createElement(CoACertificate, { data });
  const buffer = await renderToBuffer(element);
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/pdf',
    filename: `CoA-${data.report.reportNumber}.pdf`,
  };
}

export async function renderInvoice(data: InvoicePDFData): Promise<RenderResult> {
  const element = React.createElement(InvoicePDF, { data });
  const buffer = await renderToBuffer(element);
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/pdf',
    filename: `Invoice-${data.invoice.invoiceNumber}.pdf`,
  };
}

export async function renderChainOfCustody(data: ChainOfCustodyData): Promise<RenderResult> {
  const element = React.createElement(ChainOfCustodyPDF, { data });
  const buffer = await renderToBuffer(element);
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/pdf',
    filename: `CoC-${data.sample.sampleNumber}.pdf`,
  };
}

export async function renderSampleLabel(data: SampleLabelData): Promise<RenderResult> {
  const element = React.createElement(SampleLabel, { data });
  const buffer = await renderToBuffer(element);
  return {
    buffer: Buffer.from(buffer),
    mimeType: 'application/pdf',
    filename: `Label-${data.sampleNumber}.pdf`,
  };
}

export async function renderBatchLabels(labels: SampleLabelData[]): Promise<RenderResult> {
  const buffers: Buffer[] = [];
  for (const labelData of labels) {
    const result = await renderSampleLabel(labelData);
    buffers.push(result.buffer);
  }
  // For batch, return the first one; in production you'd merge PDFs
  const combined = Buffer.concat(buffers);
  return {
    buffer: combined,
    mimeType: 'application/pdf',
    filename: `Labels-batch-${Date.now()}.pdf`,
  };
}
