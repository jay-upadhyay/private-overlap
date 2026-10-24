export type StageId = 'plaintext' | 'hashing' | 'psi' | 'multi-psi' | 'dp-risk';

export interface Stage {
  id: StageId;
  number: number;
  title: string;
  summary: string;
}

/** Ordered list of demo stages; each later phase fills in one of these pages. */
export const STAGES: readonly Stage[] = [
  {
    id: 'plaintext',
    number: 0,
    title: 'Plaintext',
    summary: 'Institutions share raw lists. The baseline with no privacy.',
  },
  {
    id: 'hashing',
    number: 1,
    title: 'Hash matching',
    summary: 'Share hashed identifiers. Broken by dictionary attacks.',
  },
  {
    id: 'psi',
    number: 2,
    title: 'Two-party PSI',
    summary: 'Blinded elliptic-curve matching. Broken by fishing.',
  },
  {
    id: 'multi-psi',
    number: 3,
    title: 'Multi-party PSI',
    summary: 'Screen against several banlists. Leaks who flagged whom.',
  },
  {
    id: 'dp-risk',
    number: 4,
    title: 'DP risk scores',
    summary: 'Noisy risk tiers with query budgets.',
  },
];

export const DEFAULT_STAGE: StageId = 'plaintext';

export function isStageId(value: string): value is StageId {
  return STAGES.some((s) => s.id === value);
}
