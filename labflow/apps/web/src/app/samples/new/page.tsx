'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { SampleForm } from '@/components/samples/SampleForm';
import { useCreateSample } from '@/hooks/useSamples';

export default function NewSamplePage() {
  const router = useRouter();
  const createSample = useCreateSample();

  const handleSubmit = async (data: any) => {
    try {
      await createSample.mutateAsync(data);
      router.push('/samples');
    } catch (err) {
      // Error is handled by react-query
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Register New Sample</h1>
          <p className="text-muted-foreground">
            Enter sample details and select the tests to perform
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <SampleForm
            onSubmit={handleSubmit}
            isSubmitting={createSample.isPending}
          />
        </div>

        {createSample.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to register sample. Please check the form and try again.
          </div>
        )}
      </div>
    </MainLayout>
  );
}
