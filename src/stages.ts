import type { RecoveryScore } from './attacks/score';
import type { MatchField } from './data/normalize';
import type { PresetId } from './data/presets';
import type { Scenario } from './data/scenario';
import type { QuerierResult } from './protocol/screening';
import type { Progress, WireEntry } from './protocol/types';
import { runHashingAttack, runMultiPsiAttack, runPlaintextAttack, runPsiAttack } from './ui/attackRunners';
import { dpRisk } from './ui/explainers/dp-risk';
import { hashing } from './ui/explainers/hashing';
import { multiPsi } from './ui/explainers/multi-psi';
import { plaintext } from './ui/explainers/plaintext';
import { psi } from './ui/explainers/psi';
import type { Explainer } from './ui/explainers/types';
import { runAgainstAllHolders, runDpRisk, runTwoPartyPsi } from './ui/runners';

export type StageId = 'plaintext' | 'hashing' | 'psi' | 'multi-psi' | 'dp-risk';

/** What the page hands a stage's protocol or attack when the user presses Run. */
export interface StageRunContext {
  scenario: Scenario;
  field: MatchField;
  /** ε per released score, from the stage 4 slider. Other stages ignore it. */
  epsilon: number;
  /** Aborted when the user presses Cancel or leaves the page. */
  signal: AbortSignal;
  /** Appends a line to the wire inspector. */
  onMessage(entry: WireEntry): void;
  /** Drives the progress bar; `fraction` is per party, 0..1. */
  onProgress(progress: Progress): void;
}

export interface AttackRunContext extends StageRunContext {
  /** Wire log of the last protocol run on this page; empty if the protocol has not run. */
  wire: readonly WireEntry[];
}

export interface AttackOutcome {
  /** The secret set the attacker went after, e.g. "Copperline’s banlist emails". */
  target: string;
  score: RecoveryScore;
  /** A few recovered items to show; the panel lists the first handful. */
  examples: string[];
  note?: string;
}

export interface StageDefinition {
  id: StageId;
  number: number;
  title: string;
  summary: string;
  explainer: Explainer;
  /** Preset selected when the page opens. */
  defaultPreset: PresetId;
  /**
   * Share of the preset's customers selected when the page opens. PSI stages start at a tenth:
   * each elliptic-curve point costs about 1 ms.
   */
  defaultFraction: number;
  /** Runs the stage's protocol. */
  runProtocol?: (ctx: StageRunContext) => Promise<QuerierResult>;
  /**
   * Runs the attack named in the explainer. Ignored when the explainer marks the attack out of
   * scope. Unset means the attack demo is not built yet (see BACKLOG.md).
   */
  runAttack?: (ctx: AttackRunContext) => Promise<AttackOutcome>;
  /** The "Eavesdropper sees" line for one wire message. Defaults to sender, receiver, size and payload. */
  eavesdropperSees?: (entry: WireEntry) => string;
}

/** Ordered list of demo stages; each later phase fills in one of these pages. */
export const STAGES: readonly StageDefinition[] = [
  {
    id: 'plaintext',
    number: 0,
    title: 'Plaintext',
    summary: 'Institutions share raw lists. The baseline with no privacy.',
    explainer: plaintext,
    defaultPreset: 'portfolio',
    defaultFraction: 1,
    runProtocol: runAgainstAllHolders('plaintext'),
    runAttack: runPlaintextAttack,
    eavesdropperSees: () => 'Every identifier in the message, readable as is.',
  },
  {
    id: 'hashing',
    number: 1,
    title: 'Hash matching',
    summary: 'Share hashed identifiers. Broken by dictionary attacks.',
    explainer: hashing,
    defaultPreset: 'portfolio',
    defaultFraction: 1,
    runProtocol: runAgainstAllHolders('hashing'),
    runAttack: runHashingAttack,
  },
  {
    id: 'psi',
    number: 2,
    title: 'Two-party PSI',
    summary: 'Blinded elliptic-curve matching. Broken by fishing.',
    explainer: psi,
    defaultPreset: 'portfolio',
    defaultFraction: 0.1,
    runProtocol: runTwoPartyPsi,
    runAttack: runPsiAttack,
  },
  {
    id: 'multi-psi',
    number: 3,
    title: 'Multi-party PSI',
    summary: 'Screen against several banlists. Leaks who flagged whom.',
    explainer: multiPsi,
    defaultPreset: 'consortium',
    defaultFraction: 0.1,
    runProtocol: runAgainstAllHolders('psi-mp'),
    runAttack: runMultiPsiAttack,
  },
  {
    id: 'dp-risk',
    number: 4,
    title: 'DP risk scores',
    summary: 'Noisy risk tiers with query budgets.',
    explainer: dpRisk,
    defaultPreset: 'consortium',
    defaultFraction: 0.1,
    runProtocol: runDpRisk,
  },
];

export const DEFAULT_STAGE: StageId = 'plaintext';

export function isStageId(value: string): value is StageId {
  return STAGES.some((s) => s.id === value);
}
