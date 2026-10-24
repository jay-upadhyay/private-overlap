import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PersonFactory } from './identity';
import { noisyEmail, noisyPhone, noisyWallet } from './noise';
import { normalizeEmail, normalizePhone, normalizeWallet } from './normalize';
import { createRng } from './rng';

describe('noise', () => {
  it('canonical_values_are_normalized', () => {
    const factory = new PersonFactory(createRng(7));
    for (let i = 0; i < 2000; i++) {
      const p = factory.create();
      expect(normalizeEmail(p.email)).toBe(p.email);
      expect(normalizePhone(p.phone)).toBe(p.phone);
      expect(normalizeWallet(p.wallet)).toBe(p.wallet);
    }
  });

  it('noisy_values_normalize_to_canonical', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (personSeed, noiseSeed) => {
        const person = new PersonFactory(createRng(personSeed)).create();
        const rng = createRng(noiseSeed);
        expect(normalizeEmail(noisyEmail(rng, person.email))).toBe(person.email);
        expect(normalizePhone(noisyPhone(rng, person.phone))).toBe(person.phone);
        expect(normalizeWallet(noisyWallet(rng, person.wallet))).toBe(person.wallet);
      }),
      { numRuns: 500 },
    );
  });

  it('noise_changes_raw_values', () => {
    // Noise must actually show up, or the normalizer is never exercised.
    const factory = new PersonFactory(createRng(9));
    const rng = createRng(10);
    let changed = 0;
    for (let i = 0; i < 500; i++) {
      const p = factory.create();
      if (noisyEmail(rng, p.email) !== p.email) changed++;
    }
    expect(changed).toBeGreaterThan(250);
  });
});
