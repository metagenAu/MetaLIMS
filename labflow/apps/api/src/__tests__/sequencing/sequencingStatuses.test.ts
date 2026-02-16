import { describe, it, expect } from 'vitest';
import {
  SequencingRunStatus,
  SEQUENCING_RUN_STATUS_INFO,
  SEQUENCING_RUN_TRANSITIONS,
  isValidRunTransition,
  getAvailableRunTransitions,
  getActiveRunStatuses,
  getFinalRunStatuses,
  PcrPlateStatus,
  PCR_PLATE_STATUS_INFO,
  PCR_PLATE_TRANSITIONS,
  isValidPlateTransition,
  getAvailablePlateTransitions,
  getActivePlateStatuses,
  getFinalPlateStatuses,
} from '@labflow/shared/constants/sequencingStatuses';

// ================================================================
// Sequencing Run Statuses
// ================================================================

describe('SequencingRunStatus', () => {
  it('has exactly 6 status values', () => {
    const values = Object.values(SequencingRunStatus);
    expect(values).toHaveLength(6);
  });

  it('contains the expected status keys', () => {
    expect(SequencingRunStatus.SETUP).toBe('SETUP');
    expect(SequencingRunStatus.DNA_EXTRACTED).toBe('DNA_EXTRACTED');
    expect(SequencingRunStatus.PCR_IN_PROGRESS).toBe('PCR_IN_PROGRESS');
    expect(SequencingRunStatus.POOLED).toBe('POOLED');
    expect(SequencingRunStatus.SUBMITTED).toBe('SUBMITTED');
    expect(SequencingRunStatus.SEQUENCED).toBe('SEQUENCED');
  });
});

describe('SEQUENCING_RUN_STATUS_INFO', () => {
  it('has an entry for every run status', () => {
    for (const status of Object.values(SequencingRunStatus)) {
      expect(SEQUENCING_RUN_STATUS_INFO[status]).toBeDefined();
    }
  });

  it('each entry contains value, label, description, color, and isFinal', () => {
    for (const status of Object.values(SequencingRunStatus)) {
      const info = SEQUENCING_RUN_STATUS_INFO[status];
      expect(info).toHaveProperty('value');
      expect(info).toHaveProperty('label');
      expect(info).toHaveProperty('description');
      expect(info).toHaveProperty('color');
      expect(info).toHaveProperty('isFinal');
    }
  });

  it('each entry has value matching its key', () => {
    for (const status of Object.values(SequencingRunStatus)) {
      expect(SEQUENCING_RUN_STATUS_INFO[status].value).toBe(status);
    }
  });

  it('only SEQUENCED is marked as final', () => {
    for (const status of Object.values(SequencingRunStatus)) {
      if (status === SequencingRunStatus.SEQUENCED) {
        expect(SEQUENCING_RUN_STATUS_INFO[status].isFinal).toBe(true);
      } else {
        expect(SEQUENCING_RUN_STATUS_INFO[status].isFinal).toBe(false);
      }
    }
  });
});

describe('SEQUENCING_RUN_TRANSITIONS', () => {
  it('has an entry for every run status', () => {
    for (const status of Object.values(SequencingRunStatus)) {
      expect(SEQUENCING_RUN_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('SEQUENCED has no transitions', () => {
    expect(SEQUENCING_RUN_TRANSITIONS['SEQUENCED']).toEqual([]);
  });
});

describe('isValidRunTransition', () => {
  it('returns true for SETUP -> DNA_EXTRACTED', () => {
    expect(isValidRunTransition('SETUP', 'DNA_EXTRACTED')).toBe(true);
  });

  it('returns true for DNA_EXTRACTED -> PCR_IN_PROGRESS', () => {
    expect(isValidRunTransition('DNA_EXTRACTED', 'PCR_IN_PROGRESS')).toBe(true);
  });

  it('returns false for SETUP -> POOLED (skipping steps)', () => {
    expect(isValidRunTransition('SETUP', 'POOLED')).toBe(false);
  });

  it('returns false for SEQUENCED -> SETUP (backward transition)', () => {
    expect(isValidRunTransition('SEQUENCED', 'SETUP')).toBe(false);
  });
});

describe('getAvailableRunTransitions', () => {
  it('returns ["DNA_EXTRACTED"] for SETUP', () => {
    expect(getAvailableRunTransitions('SETUP')).toEqual(['DNA_EXTRACTED']);
  });

  it('returns an empty array for SEQUENCED', () => {
    expect(getAvailableRunTransitions('SEQUENCED')).toEqual([]);
  });
});

describe('getActiveRunStatuses', () => {
  it('returns 5 statuses (all except SEQUENCED)', () => {
    const active = getActiveRunStatuses();
    expect(active).toHaveLength(5);
    expect(active).toContain('SETUP');
    expect(active).toContain('DNA_EXTRACTED');
    expect(active).toContain('PCR_IN_PROGRESS');
    expect(active).toContain('POOLED');
    expect(active).toContain('SUBMITTED');
    expect(active).not.toContain('SEQUENCED');
  });
});

describe('getFinalRunStatuses', () => {
  it('returns only SEQUENCED', () => {
    const final = getFinalRunStatuses();
    expect(final).toEqual(['SEQUENCED']);
  });
});

// ================================================================
// PCR Plate Statuses
// ================================================================

describe('PcrPlateStatus', () => {
  it('has exactly 5 status values', () => {
    const values = Object.values(PcrPlateStatus);
    expect(values).toHaveLength(5);
  });

  it('contains the expected status values', () => {
    expect(PcrPlateStatus.SETUP).toBe('PLATE_SETUP');
    expect(PcrPlateStatus.PCR_COMPLETE).toBe('PCR_COMPLETE');
    expect(PcrPlateStatus.GEL_CHECKED).toBe('GEL_CHECKED');
    expect(PcrPlateStatus.POOLING_ASSIGNED).toBe('POOLING_ASSIGNED');
    expect(PcrPlateStatus.DONE).toBe('PLATE_DONE');
  });
});

describe('PCR_PLATE_STATUS_INFO', () => {
  it('has an entry for every plate status', () => {
    for (const status of Object.values(PcrPlateStatus)) {
      expect(PCR_PLATE_STATUS_INFO[status]).toBeDefined();
    }
  });

  it('each entry contains value, label, description, color, and isFinal', () => {
    for (const status of Object.values(PcrPlateStatus)) {
      const info = PCR_PLATE_STATUS_INFO[status];
      expect(info).toHaveProperty('value');
      expect(info).toHaveProperty('label');
      expect(info).toHaveProperty('description');
      expect(info).toHaveProperty('color');
      expect(info).toHaveProperty('isFinal');
    }
  });

  it('only PLATE_DONE is marked as final', () => {
    for (const status of Object.values(PcrPlateStatus)) {
      if (status === PcrPlateStatus.DONE) {
        expect(PCR_PLATE_STATUS_INFO[status].isFinal).toBe(true);
      } else {
        expect(PCR_PLATE_STATUS_INFO[status].isFinal).toBe(false);
      }
    }
  });
});

describe('PCR_PLATE_TRANSITIONS', () => {
  it('has an entry for every plate status', () => {
    for (const status of Object.values(PcrPlateStatus)) {
      expect(PCR_PLATE_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('PLATE_DONE has no transitions', () => {
    expect(PCR_PLATE_TRANSITIONS['PLATE_DONE']).toEqual([]);
  });
});

describe('isValidPlateTransition', () => {
  it('returns true for PLATE_SETUP -> PCR_COMPLETE', () => {
    expect(isValidPlateTransition('PLATE_SETUP', 'PCR_COMPLETE')).toBe(true);
  });

  it('returns false for PLATE_SETUP -> PLATE_DONE (skipping steps)', () => {
    expect(isValidPlateTransition('PLATE_SETUP', 'PLATE_DONE')).toBe(false);
  });
});

describe('getAvailablePlateTransitions', () => {
  it('returns ["PCR_COMPLETE"] for PLATE_SETUP', () => {
    expect(getAvailablePlateTransitions('PLATE_SETUP')).toEqual(['PCR_COMPLETE']);
  });

  it('returns an empty array for PLATE_DONE', () => {
    expect(getAvailablePlateTransitions('PLATE_DONE')).toEqual([]);
  });
});

describe('getActivePlateStatuses', () => {
  it('returns 4 statuses (all except PLATE_DONE)', () => {
    const active = getActivePlateStatuses();
    expect(active).toHaveLength(4);
    expect(active).toContain('PLATE_SETUP');
    expect(active).toContain('PCR_COMPLETE');
    expect(active).toContain('GEL_CHECKED');
    expect(active).toContain('POOLING_ASSIGNED');
    expect(active).not.toContain('PLATE_DONE');
  });
});

describe('getFinalPlateStatuses', () => {
  it('returns only PLATE_DONE', () => {
    const final = getFinalPlateStatuses();
    expect(final).toEqual(['PLATE_DONE']);
  });
});
