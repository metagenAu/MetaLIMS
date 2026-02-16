'use client';

import { Check, Clock, FlaskConical, Dna, Microscope, Cpu, BarChart3, FileText, Package } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Stage definitions for soil health / metabarcoding workflows displayed
 * on the client portal.  These map to the WorkflowStageDefinition records
 * in the database but are defined here for the portal's lightweight bundle.
 */
const SOIL_HEALTH_STEPS = [
  { key: 'REGISTERED', label: 'Registered', icon: Package },
  { key: 'RECEIVED', label: 'Received', icon: Check },
  { key: 'WEIGHING', label: 'Weighing', icon: FlaskConical },
  { key: 'DNA_EXTRACTION', label: 'DNA Extraction', icon: Dna },
  { key: 'PCR', label: 'PCR', icon: Microscope },
  { key: 'SEQUENCING', label: 'Sequencing', icon: Cpu },
  { key: 'BIOINFORMATICS', label: 'Bioinformatics', icon: BarChart3 },
  { key: 'RESULTS_READY', label: 'Results Ready', icon: Check },
  { key: 'REPORT_SENT', label: 'Report Sent', icon: FileText },
];

const STAGE_ORDER: Record<string, number> = {};
SOIL_HEALTH_STEPS.forEach((step, index) => {
  STAGE_ORDER[step.key] = index;
});

interface SampleStageTrackerProps {
  /** Current stage key (e.g. "DNA_EXTRACTION"). */
  currentStageKey: string;
  /** Category (currently only "SOIL_HEALTH" renders a custom view). */
  category?: string;
  className?: string;
}

export default function SampleStageTracker({
  currentStageKey,
  category = 'SOIL_HEALTH',
  className,
}: SampleStageTrackerProps) {
  const currentIndex = STAGE_ORDER[currentStageKey] ?? -1;

  return (
    <div className={clsx('w-full', className)}>
      {/* Compact horizontal stepper */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {SOIL_HEALTH_STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          const isPending = currentIndex < index;

          return (
            <div key={step.key} className="flex flex-1 items-center min-w-0">
              <div className="flex flex-col items-center min-w-0">
                <div
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors shrink-0',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary/10 text-primary',
                    isPending && 'border-muted bg-muted text-muted-foreground',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span
                  className={clsx(
                    'mt-1.5 text-center text-[10px] font-medium leading-tight',
                    isCompleted && 'text-primary',
                    isCurrent && 'text-primary',
                    isPending && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < SOIL_HEALTH_STEPS.length - 1 && (
                <div
                  className={clsx(
                    'mx-0.5 mt-[-1rem] h-0.5 flex-1 min-w-1',
                    currentIndex > index ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
