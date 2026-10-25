import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TOY_ORDER, TOY_P, toyHash, toyPow } from './toyGroup';

describe('toy group for the PSI worked example', () => {
  it('generator_has_order_509', () => {
    expect(toyPow(4n, TOY_ORDER)).toBe(1n);
    expect(toyPow(4n, 2n)).not.toBe(1n);
    expect(TOY_P).toBe(2n * TOY_ORDER + 1n);
  });

  it('blinding_commutes', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.bigInt({ min: 1n, max: TOY_ORDER - 1n }),
        fc.bigInt({ min: 1n, max: TOY_ORDER - 1n }),
        (x, q, k) => {
          const h = toyHash(x);
          expect(toyPow(toyPow(h, q), k)).toBe(toyPow(toyPow(h, k), q));
        },
      ),
    );
  });

  it('hash_lands_in_the_subgroup', () => {
    for (const x of ['alicesmith@gmail.com', 'dave@yahoo.com', ''])
      expect(toyPow(toyHash(x), TOY_ORDER)).toBe(1n);
  });
});
