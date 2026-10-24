import type { MatchField } from '../data/normalize';
import type { BanlistRecord, CustomerRecord, Scenario } from '../data/scenario';
import type { Tier } from '../dp/bounds';
import type { PartyId, PartySpec, Protocol } from './types';

// Shared inputs and outputs for every screening protocol (stages 0-3), so the UI,
// the attacks and the tests treat all stages the same way. Stage 4 extends the
// querier result with noisy scores instead of exact flags.

export interface QuerierInput {
  kind: 'querier';
  field: MatchField;
  records: CustomerRecord[];
  holders: PartyId[];
}

export interface HolderInput {
  kind: 'holder';
  field: MatchField;
  records: BanlistRecord[];
  querier: PartyId;
}

export type ScreeningInput = QuerierInput | HolderInput;

/** Stage 4's per-customer output: a noisy count of flagging institutions and its tier. */
export interface RiskScore {
  noisy: number;
  tier: Tier;
}

export interface QuerierResult {
  kind: 'querier';
  /** Querier rowId -> holders that flag it. Only flagged rows appear. Empty in stage 4. */
  flaggedBy: Record<string, PartyId[]>;
  /** Stage 4 only: querier rowId -> noisy risk score, for every scored customer. */
  scores?: Record<string, RiskScore>;
  skipped: string[];
}

export interface HolderResult {
  kind: 'holder';
  /** How many querier values the holder processed: the one thing PSI lets it learn. */
  screened: number;
  skipped: string[];
}

export type ScreeningResult = QuerierResult | HolderResult;

export type ScreeningProtocol = Protocol<ScreeningInput, ScreeningResult>;

export const QUERIER_ROLE = 'querier';
export const HOLDER_ROLE = 'holder';

/** One party per institution in the scenario, querier first. */
export function screeningParties(scenario: Scenario, field: MatchField): PartySpec<ScreeningInput>[] {
  const querier = scenario.querier.institution.id;
  const holders = scenario.holders.map((h) => h.institution.id);
  return [
    {
      id: querier,
      role: QUERIER_ROLE,
      input: { kind: 'querier', field, records: scenario.querier.records, holders },
    },
    ...scenario.holders.map((h) => ({
      id: h.institution.id,
      role: HOLDER_ROLE,
      input: { kind: 'holder' as const, field, records: h.records, querier },
    })),
  ];
}

/** The querier result that ground truth says a correct protocol must produce. */
export function expectedQuerierResult(scenario: Scenario): QuerierResult['flaggedBy'] {
  const holders = scenario.holders.map((h) => h.institution.id);
  const out: Record<string, PartyId[]> = {};
  for (const [rowId, by] of Object.entries(scenario.truth.flaggedBy)) {
    out[rowId] = holders.filter((h) => by.includes(h));
  }
  return out;
}
