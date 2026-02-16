'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackageCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { BarcodeScanner } from '@/components/samples/BarcodeScanner';
import { useReceiveSamples } from '@/hooks/useSamples';

export default function ReceiveSamplesPage() {
  const router = useRouter();
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [received, setReceived] = useState(false);
  const receiveSamples = useReceiveSamples();

  const handleScan = (barcode: string) => {
    setScannedItems((prev) => [...prev, barcode]);
  };

  const handleRemove = (barcode: string) => {
    setScannedItems((prev) => prev.filter((item) => item !== barcode));
  };

  const handleReceive = async () => {
    try {
      await receiveSamples.mutateAsync(scannedItems);
      setReceived(true);
    } catch {
      // Error handled by react-query
    }
  };

  if (received) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold">Samples Received</h2>
          <p className="text-muted-foreground mt-1">
            {scannedItems.length} samples have been marked as received.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setScannedItems([]);
                setReceived(false);
              }}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Receive More
            </button>
            <button
              onClick={() => router.push('/samples')}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Samples
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Receive Samples</h1>
          <p className="text-muted-foreground">
            Scan sample barcodes to mark them as received at the laboratory
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <BarcodeScanner
            onScan={handleScan}
            scannedItems={scannedItems}
            onRemove={handleRemove}
            isProcessing={receiveSamples.isPending}
          />
        </div>

        {scannedItems.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="text-sm font-medium">
                {scannedItems.length} samples ready to receive
              </p>
              <p className="text-xs text-muted-foreground">
                Receiving will update the status and record the chain of custody
              </p>
            </div>
            <button
              onClick={handleReceive}
              disabled={receiveSamples.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {receiveSamples.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PackageCheck className="h-4 w-4" />
                  Receive All
                </>
              )}
            </button>
          </div>
        )}

        {receiveSamples.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to receive samples. Some sample IDs may be invalid. Please
            verify and try again.
          </div>
        )}
      </div>
    </MainLayout>
  );
}
