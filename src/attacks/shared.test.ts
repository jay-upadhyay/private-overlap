import { describe, expect, it } from 'vitest';
import { extractIdentifiers } from '../data/identifiers';
import { smallScenario } from '../test/fixtures';
import { breachCorpus, emailPatternCandidates } from './candidates';
import { scoreRecovery } from './score';

describe('attacks/candidates', () => {
  it('pattern_candidates_cover_unsuffixed_generator_emails', () => {
    const candidates = new Set(emailPatternCandidates());
    const scenario = smallScenario({ customers: 2000 });
    const emails = extractIdentifiers(scenario.querier.records, 'email').values;
    const plain = emails.filter((e) => !/\d@/.test(e));
    expect(plain.length).toBeGreaterThan(500);
    for (const email of plain) expect(candidates.has(email)).toBe(true);
  });

  it('pattern_candidates_are_unique', () => {
    const list = [...emailPatternCandidates()];
    expect(new Set(list).size).toBe(list.length);
  });

  it('suffix_options_add_suffixed_candidates', () => {
    let seen = 0;
    let suffixed = 0;
    for (const email of emailPatternCandidates({ numberSuffixes: true, yearSuffixes: true })) {
      if (/\d@/.test(email)) suffixed++;
      if (++seen === 5000) break;
    }
    expect(suffixed).toBeGreaterThan(4000);
  });

  it('breach_corpus_has_requested_coverage_and_decoys', () => {
    const population = extractIdentifiers(smallScenario().querier.records, 'email').values;
    const corpus = breachCorpus(population, 'email', { coverage: 0.5, decoys: 300, seed: 4 });
    expect(corpus).toHaveLength(100 + 300);
    expect(scoreRecovery(corpus, population).recall).toBe(0.5);
  });
});

describe('attacks/score', () => {
  it('scores_recall_and_precision', () => {
    expect(scoreRecovery(['a', 'b', 'x'], ['a', 'b', 'c', 'd'])).toEqual({
      truePositives: 2,
      falsePositives: 1,
      missed: 2,
      recall: 0.5,
      precision: 2 / 3,
    });
    expect(scoreRecovery([], []).recall).toBe(1);
  });
});
