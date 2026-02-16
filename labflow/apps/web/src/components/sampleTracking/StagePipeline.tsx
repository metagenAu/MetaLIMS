'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PipelineStage {
  stageKey: string;
  label: string;
  color: string;
  sortOrder: number;
  sampleCount: number;
  expectedDurationHours: number | null;
}

interface CategoryPipeline {
  category: string;
  categoryLabel: string;
  stages: PipelineStage[];
  totalSamples: number;
}

interface StagePipelineProps {
  category: CategoryPipeline;
}

export function StagePipeline({ category }: StagePipelineProps) {
  const maxCount = Math.max(...category.stages.map((s) => s.sampleCount), 1);

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{category.categoryLabel}</h3>
          <p className="text-xs text-muted-foreground">
            {category.totalSamples} samples in pipeline
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {category.stages.length} stages
        </span>
      </div>

      {/* Pipeline columns */}
      <div className="flex items-end gap-1">
        {category.stages.map((stage, index) => {
          const heightPercent =
            maxCount > 0 ? Math.max((stage.sampleCount / maxCount) * 100, 4) : 4;

          return (
            <div key={stage.stageKey} className="flex-1 min-w-0">
              {/* Bar */}
              <div className="relative flex flex-col items-center">
                {/* Count label */}
                <span className="mb-1 text-xs font-semibold text-foreground">
                  {stage.sampleCount}
                </span>
                {/* Bar */}
                <div
                  className="w-full rounded-t-md transition-all duration-300"
                  style={{
                    height: `${Math.round(heightPercent * 1.2)}px`,
                    minHeight: '8px',
                    maxHeight: '120px',
                    backgroundColor: stage.color,
                    opacity: stage.sampleCount > 0 ? 1 : 0.3,
                  }}
                />
              </div>
              {/* Stage label */}
              <div className="mt-2 text-center">
                <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground">
                  {stage.label}
                </p>
              </div>
              {/* Connector arrow (not on last) */}
              {index < category.stages.length - 1 && (
                <div className="absolute right-0 top-1/2 hidden" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage flow indicator */}
      <div className="mt-4 flex items-center gap-0.5">
        {category.stages.map((stage, index) => (
          <React.Fragment key={stage.stageKey}>
            <div
              className="h-1.5 flex-1 rounded-full"
              style={{
                backgroundColor: stage.color,
                opacity: stage.sampleCount > 0 ? 1 : 0.2,
              }}
            />
            {index < category.stages.length - 1 && (
              <div className="h-1.5 w-1.5 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
