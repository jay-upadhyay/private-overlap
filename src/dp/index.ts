// Public API of the DP primitives used by the stage 4 coordinator.
export { addNoise, sampleDiscreteLaplace } from './noise';
export {
  BudgetLedger,
  DEFAULT_LEDGER_CONFIG,
  DEFAULT_PERIOD_BUDGET,
  DEFAULT_SCORE_EPSILON,
  DEFAULT_SUBJECT_CAP,
  type LedgerConfig,
  type LedgerEntry,
  type SpendDecision,
  type SpendRequest,
} from './ledger';
export {
  DEFAULT_TIER_THRESHOLDS,
  discreteLaplaceCdf,
  discreteLaplaceMeanAbsError,
  discreteLaplacePmf,
  discreteLaplaceVariance,
  membershipAccuracyBound,
  TIER_LABELS,
  tierAccuracy,
  tierOf,
  tierProbabilities,
  type Tier,
  type TierThresholds,
} from './bounds';
export { format, toNumber, toRational, type EpsilonInput, type Rational } from './rational';
