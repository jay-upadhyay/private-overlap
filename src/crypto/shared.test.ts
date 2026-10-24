import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seededSource } from '../test/fixtures';
import { bytesEqual, bytesToHex, packFixed, unpackFixed } from './bytes';
import { randomBytes, secureShuffle, uniformInt } from './random';
import { hashIdentifier, hmacIdentifier, HASH_BYTES } from './sha256';

describe('crypto/random', () => {
  it('uniform_int_in_range', () => {
    const source = seededSource(1);
    for (const max of [1, 2, 3, 7, 1000, 2 ** 32]) {
      for (let i = 0; i < 200; i++) {
        const x = uniformInt(max, source);
        expect(Number.isInteger(x) && x >= 0 && x < max).toBe(true);
      }
    }
    expect(() => uniformInt(0)).toThrow(RangeError);
  });

  it('uniform_int_is_unbiased', () => {
    // 60,000 draws over 3 buckets: each within 2% of 1/3.
    const source = seededSource(2);
    const counts = [0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[uniformInt(3, source)]!++;
    for (const c of counts) expect(Math.abs(c / 60_000 - 1 / 3)).toBeLessThan(0.02);
  });

  it('secure_shuffle_is_a_permutation', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (items) => {
        const shuffled = secureShuffle([...items]);
        expect([...shuffled].sort()).toEqual([...items].sort());
      }),
    );
  });

  it('large_random_buffers_fill_completely', () => {
    // getRandomValues refuses more than 65,536 bytes per call.
    const bytes = randomBytes(200_000);
    expect(bytes.subarray(150_000).some((b) => b !== 0)).toBe(true);
  });
});

describe('crypto/bytes', () => {
  it('pack_unpack_round_trip', () => {
    fc.assert(
      fc.property(fc.array(fc.uint8Array({ minLength: 32, maxLength: 32 })), (items) => {
        const unpacked = unpackFixed(packFixed(items, 32), 32);
        expect(unpacked).toHaveLength(items.length);
        unpacked.forEach((u, i) => expect(bytesEqual(u, items[i]!)).toBe(true));
      }),
    );
  });

  it('pack_rejects_wrong_width', () => {
    expect(() => packFixed([new Uint8Array(31)], 32)).toThrow(RangeError);
    expect(() => unpackFixed(new Uint8Array(33), 32)).toThrow(RangeError);
  });
});

describe('crypto/sha256', () => {
  it('matches_known_vector', () => {
    expect(bytesToHex(hashIdentifier('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashIdentifier('abc')).toHaveLength(HASH_BYTES);
  });

  it('hmac_depends_on_key', () => {
    const a = hmacIdentifier(new Uint8Array(32).fill(1), 'jane@gmail.com');
    const b = hmacIdentifier(new Uint8Array(32).fill(2), 'jane@gmail.com');
    expect(bytesEqual(a, b)).toBe(false);
    expect(bytesEqual(a, hashIdentifier('jane@gmail.com'))).toBe(false);
  });
});
