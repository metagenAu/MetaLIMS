'use client';

import React, { useState, useRef } from 'react';
import { ScanBarcode, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  scannedItems: string[];
  onRemove: (barcode: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export function BarcodeScanner({
  onScan,
  scannedItems,
  onRemove,
  isProcessing = false,
  placeholder = 'Scan barcode or enter sample ID...',
}: BarcodeScannerProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const barcode = inputValue.trim().toUpperCase();
      if (!scannedItems.includes(barcode)) {
        onScan(barcode);
      }
      setInputValue('');
    }
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      const barcode = inputValue.trim().toUpperCase();
      if (!scannedItems.includes(barcode)) {
        onScan(barcode);
      }
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            data-barcode-input="true"
            autoFocus
            className="flex h-10 w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {isProcessing && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {scannedItems.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2">
            <p className="text-sm font-medium">
              Scanned Items ({scannedItems.length})
            </p>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto scrollbar-thin">
            {scannedItems.map((barcode, index) => (
              <div
                key={barcode}
                className="flex items-center justify-between px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm font-mono">{barcode}</span>
                </div>
                <button
                  onClick={() => onRemove(barcode)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ScanBarcode className="h-3.5 w-3.5" />
        <span>
          Scan barcodes with a scanner or type sample IDs manually. Press Enter
          to add.
        </span>
      </div>
    </div>
  );
}
