import { describe, expect, it } from 'vitest';
import { expectedQuerierResult, type QuerierResult } from '../protocol/screening';
import type { WireEntry } from '../protocol/types';
import { smallScenario } from '../test/fixtures';
import { describeRun, runFacts } from './narrative';

const scenario = smallScenario({ holders: 3, banlistSize: 120, flaggedByCount: [0.1, 0.05, 0.02] });
const exactResult: QuerierResult = {
  kind: 'querier',
  flaggedBy: expectedQuerierResult(scenario),
  skipped: [],
};
const wire: WireEntry[] = [
  { seq: 0, from: 'q', to: 'h1', type: 't', round: 1, bytes: 1000, preview: '' },
  { seq: 1, from: 'h1', to: 'q', type: 't', round: 2, bytes: 2000, preview: '' },
];
const flagged = Object.keys(scenario.truth.flaggedBy).length;

describe('run narrative', () => {
  it('facts_match_ground_truth', () => {
    const f = runFacts('multi-psi', scenario, 'email', exactResult, wire, 1500, 0.5);
    expect(f.flaggedFound).toBe(flagged);
    expect(f.flaggedTruth).toBe(flagged);
    expect(f.messages).toBe(2);
    expect(f.bytes).toBe(3000);
    expect(f.attributionExample?.by.length).toBeGreaterThanOrEqual(2);
  });

  it('only_plaintext_and_hashing_expose_non_customers', () => {
    const exposed = (s: 'plaintext' | 'hashing' | 'psi' | 'multi-psi') =>
      runFacts(s, scenario, 'email', exactResult, wire, 1, 0.5).nonCustomersExposed;
    expect(exposed('plaintext')).toBeGreaterThan(0);
    expect(exposed('hashing')).toBe(exposed('plaintext'));
    expect(exposed('psi')).toBe(0);
    expect(exposed('multi-psi')).toBe(0);
  });

  it('two_party_counts_only_the_first_holder', () => {
    const f = runFacts('psi', scenario, 'email', exactResult, wire, 1, 0.5);
    expect(f.holders).toEqual(['Test Holder 1']);
    expect(f.flaggedTruth).toBe(
      Object.values(scenario.truth.flaggedBy).filter((by) => by.includes('h1')).length,
    );
  });

  it('every_stage_gets_three_sentences_with_its_numbers', () => {
    for (const s of ['plaintext', 'hashing', 'psi', 'multi-psi'] as const) {
      const lines = describeRun(runFacts(s, scenario, 'email', exactResult, wire, 2500, 0.5));
      expect(lines, s).toHaveLength(3);
      expect(lines.join(' '), s).toContain('2.5 s');
    }
    const scores = Object.fromEntries(
      scenario.querier.records.map((r) => [r.rowId, { noisy: 0, tier: 'clear' as const }]),
    );
    const dp = runFacts(
      'dp-risk',
      scenario,
      'email',
      { ...exactResult, flaggedBy: {}, scores },
      wire,
      4000,
      0.5,
    );
    const text = describeRun(dp).join(' ');
    expect(text).toContain(`${scenario.querier.records.length} risk tiers`);
    expect(text).toContain(`ε ${scenario.querier.records.length * 0.5}`);
    expect(dp.attributionExample).toBeUndefined();
  });
});
