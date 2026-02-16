'use client';

import React from 'react';
import { StatusBadge } from '@/components/common/StatusBadge';

interface SampleStatusBadgeProps {
  status: string;
  className?: string;
}

export function SampleStatusBadge({ status, className }: SampleStatusBadgeProps) {
  return <StatusBadge status={status} className={className} />;
}
