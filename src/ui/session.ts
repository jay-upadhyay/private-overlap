import { useSyncExternalStore } from 'react';
import type { MatchField } from '../data/normalize';
import type { RunFacts } from './narrative';
import type { PresetId } from '../data/presets';
import type { StageId } from '../stages';

// Page-session state shared across stage pages: the guided walkthrough's scenario, and a log of
// the latest run on each stage for the summary page. Kept in memory: a reload starts fresh.

export interface WalkthroughState {
  presetId: PresetId;
  seed: string;
  field: MatchField;
  /** Customer count, so every stage runs at the same size (PSI keeps it small enough to be quick). */
  customers: string;
}

/** What one completed run showed, for the summary table. */
export interface StageRunRecord {
  /** Preset, size, seed and field: runs compare like for like only when these match. */
  scenarioKey: string;
  scenarioLabel: string;
  facts: RunFacts;
  attack?: { target: string; recovered: number; total: number; recall: number };
}

interface SessionState {
  walkthrough: WalkthroughState | null;
  runs: Partial<Record<StageId, StageRunRecord>>;
}

let state: SessionState = { walkthrough: null, runs: {} };
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  for (const l of listeners) l();
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function sessionState(): SessionState {
  return state;
}

export const WALKTHROUGH_START: WalkthroughState = {
  presetId: 'consortium',
  seed: '303',
  field: 'email',
  customers: '1000',
};

export function startWalkthrough(): void {
  set({ walkthrough: WALKTHROUGH_START, runs: {} });
}

export function endWalkthrough(): void {
  set({ ...state, walkthrough: null });
}

/** While the walkthrough runs, a scenario change on any stage carries to the next one. */
export function updateWalkthrough(patch: Partial<WalkthroughState>): void {
  if (state.walkthrough) set({ ...state, walkthrough: { ...state.walkthrough, ...patch } });
}

export function recordRun(stage: StageId, record: StageRunRecord): void {
  set({ ...state, runs: { ...state.runs, [stage]: record } });
}

export function recordAttack(stage: StageId, attack: NonNullable<StageRunRecord['attack']>): void {
  const run = state.runs[stage];
  if (run) set({ ...state, runs: { ...state.runs, [stage]: { ...run, attack } } });
}

/** Test only. */
export function resetSessionForTests(): void {
  set({ walkthrough: null, runs: {} });
}
