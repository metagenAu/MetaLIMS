// ============================================================
// Sample Types & Interfaces
// ============================================================

export const SampleStatus = {
  REGISTERED: 'REGISTERED',
  RECEIVED: 'RECEIVED',
  IN_STORAGE: 'IN_STORAGE',
  IN_PROGRESS: 'IN_PROGRESS',
  TESTING_COMPLETE: 'TESTING_COMPLETE',
  APPROVED: 'APPROVED',
  REPORTED: 'REPORTED',
  ON_HOLD: 'ON_HOLD',
  DISPOSED: 'DISPOSED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type SampleStatus = (typeof SampleStatus)[keyof typeof SampleStatus];

export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  RUSH: 'RUSH',
  EMERGENCY: 'EMERGENCY',
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

export interface Sample {
  id: string;
  organizationId: string;
  orderId: string;
  sampleNumber: string;
  clientSampleId: string | null;
  name: string | null;
  description: string | null;
  matrix: string | null;
  sampleType: string | null;
  collectedDate: Date | null;
  collectedBy: string | null;
  collectionLocation: string | null;
  collectionMethod: string | null;
  receivedDate: Date | null;
  receivedById: string | null;
  conditionOnReceipt: string | null;
  temperatureOnReceipt: number | null;
  status: SampleStatus;
  storageLocationId: string | null;
  storageCondition: string | null;
  disposalDate: Date | null;
  disposalMethod: string | null;
  disposedById: string | null;
  parentSampleId: string | null;
  barcodeValue: string;
  barcodeFormat: string;
  quantity: number | null;
  quantityUnit: string | null;
  lotNumber: string | null;
  batchNumber: string | null;
  expirationDate: Date | null;
  tags: string[];
  customFields: Record<string, unknown>;
  notes: string | null;
  attachments: SampleAttachment[];
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SampleAttachment {
  id: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedById: string;
}

export interface CreateSampleInput {
  orderId: string;
  clientSampleId?: string | null;
  name?: string | null;
  description?: string | null;
  matrix?: string | null;
  sampleType?: string | null;
  collectedDate?: Date | null;
  collectedBy?: string | null;
  collectionLocation?: string | null;
  collectionMethod?: string | null;
  conditionOnReceipt?: string | null;
  temperatureOnReceipt?: number | null;
  storageCondition?: string | null;
  parentSampleId?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  lotNumber?: string | null;
  batchNumber?: string | null;
  expirationDate?: Date | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string | null;
}

export interface UpdateSampleInput {
  clientSampleId?: string | null;
  name?: string | null;
  description?: string | null;
  matrix?: string | null;
  sampleType?: string | null;
  collectedDate?: Date | null;
  collectedBy?: string | null;
  collectionLocation?: string | null;
  collectionMethod?: string | null;
  conditionOnReceipt?: string | null;
  temperatureOnReceipt?: number | null;
  status?: SampleStatus;
  storageLocationId?: string | null;
  storageCondition?: string | null;
  disposalDate?: Date | null;
  disposalMethod?: string | null;
  disposedById?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  lotNumber?: string | null;
  batchNumber?: string | null;
  expirationDate?: Date | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string | null;
}

export interface ReceiveSampleInput {
  receivedById: string;
  receivedDate?: Date;
  conditionOnReceipt?: string | null;
  temperatureOnReceipt?: number | null;
  storageLocationId?: string | null;
  storageCondition?: string | null;
  notes?: string | null;
}

export interface SampleFilterParams {
  organizationId: string;
  orderId?: string;
  status?: SampleStatus | SampleStatus[];
  sampleType?: string;
  matrix?: string;
  tags?: string[];
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  receivedFrom?: Date;
  receivedTo?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ChainOfCustodyEntry {
  id: string;
  sampleId: string;
  action: string;
  fromLocation: string | null;
  toLocation: string | null;
  performedById: string;
  performedAt: Date;
  notes: string | null;
  signatureUrl: string | null;
  temperature: number | null;
}

export interface CreateChainOfCustodyInput {
  sampleId: string;
  action: string;
  fromLocation?: string | null;
  toLocation?: string | null;
  performedById: string;
  notes?: string | null;
  signatureUrl?: string | null;
  temperature?: number | null;
}
