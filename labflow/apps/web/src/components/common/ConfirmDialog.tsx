'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-card p-6 shadow-lg">
          <div className="flex items-start gap-4">
            {variant === 'destructive' && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                variant === 'destructive'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          </div>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
