import { useState, useEffect, useCallback, useRef } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxDelay?: number; // ms between keystrokes that counts as scanner input
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minLength = 6,
  maxDelay = 50,
  enabled = true,
}: BarcodeScannerOptions) {
  const [buffer, setBuffer] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bufferRef = useRef('');

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    setBuffer('');
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input (except our barcode input)
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        if (!target.dataset.barcodeInput) return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          const scannedValue = bufferRef.current.trim();
          setLastScan(scannedValue);
          onScan(scannedValue);
        }
        resetBuffer();
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
        setBuffer(bufferRef.current);
        setIsScanning(true);

        timerRef.current = setTimeout(() => {
          resetBuffer();
        }, maxDelay * 20); // Allow longer for full barcode
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, minLength, maxDelay, onScan, resetBuffer]);

  return {
    buffer,
    lastScan,
    isScanning,
    reset: resetBuffer,
  };
}
