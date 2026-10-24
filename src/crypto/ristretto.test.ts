import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bytesToHex as toHex, hexToBytes as fromHex, utf8ToBytes } from './bytes';
import {
  GROUP_ORDER,
  PSI_DST,
  decodePoint,
  deriveElement,
  encodePoint,
  expandMessageXmd,
  hashToGroup,
  multiply,
  packPoints,
  randomScalar,
  unpackPoints,
} from './ristretto';

// RFC 9496 Appendix A.3: element derivation inputs (64 bytes) and encoded outputs.
const ELEMENT_DERIVATION_VECTORS: [string, string][] = [
  [
    '5d1be09e3d0c82fc538112490e35701979d99e06ca3e2b5b54bffe8b4dc772c14d98b696a1bbfb5ca32c436cc61c16563790306c79eaca7705668b47dffe5bb6',
    '3066f82a1a747d45120d1740f14358531a8f04bbffe6a819f86dfe50f44a0a46',
  ],
  [
    'f116b34b8f17ceb56e8732a60d913dd10cce47a6d53bee9204be8b44f6678b270102a56902e2488c46120e9276cfe54638286b9e4b3cdb470b542d46c2068d38',
    'f26e5b6f7d362d2d2a94c5d0e7602cb4773c95a2e5c31a64f133189fa76ed61b',
  ],
  [
    '8422e1bbdaab52938b81fd602effb6f89110e1e57208ad12d9ad767e2e25510c27140775f9337088b982d83d7fcf0b2fa1edffe51952cbe7365e95c86eaf325c',
    '006ccd2a9e6867e6a2c5cea83d3302cc9de128dd2a9a57dd8ee7b9d7ffe02826',
  ],
  [
    'ac22415129b61427bf464e17baee8db65940c233b98afce8d17c57beeb7876c2150d15af1cb1fb824bbd14955f2b57d08d388aab431a391cfc33d5bafb5dbbaf',
    'f8f0c87cf237953c5890aec3998169005dae3eca1fbb04548c635953c817f92a',
  ],
  [
    '165d697a1ef3d5cf3c38565beefcf88c0f282b8e7dbd28544c483432f1cec7675debea8ebb4e5fe7d6f6e5db15f15587ac4d4d4a1de7191e0c1ca6664abcc413',
    'ae81e7dedf20a497e10c304a765c1767a42d6e06029758d2d7e8ef7cc4c41179',
  ],
  [
    'a836e6c9a9ca9f1e8d486273ad56a78c70cf18f0ce10abb1c7172ddd605d7fd2979854f47ae1ccf204a33102095b4200e5befc0465accc263175485f0e17ea5c',
    'e2705652ff9f5e44d3e841bf1c251cf7dddb77d140870d1ab2ed64f1a9ce8628',
  ],
  [
    '2cdc11eaeb95daf01189417cdddbf95952993aa9cb9c640eb5058d09702c74622c9965a697a3b345ec24ee56335b556e677b30e6f90ac77d781064f866a3c982',
    '80bd07262511cdde4863f8a7434cef696750681cb9510eea557088f76d9e5065',
  ],
];

// RFC 9496 Appendix A.3: these four inputs all map to the same element.
const SAME_ELEMENT_INPUTS = [
  'edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1200000000000000000000000000000000000000000000000000000000000000',
  'edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  '0000000000000000000000000000000000000000000000000000000000000080ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  '00000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000080',
];
const SAME_ELEMENT_OUTPUT = '304282791023b73128d277bdcb5c7746ef2eac08dde9f2983379cb8e5ef0517f';

// RFC 9380 Appendix K.3: expand_message_xmd(SHA-512), len_in_bytes = 0x20.
const XMD_DST = 'QUUX-V01-CS02-with-expander-SHA512-256';
const XMD_VECTORS: [string, string][] = [
  ['', '6b9a7312411d92f921c6f68ca0b6380730a1a4d982c507211a90964c394179ba'],
  ['abc', '0da749f12fbe5483eb066a5f595055679b976e93abe9be6f0f6318bce7aca8dc'],
];

const scalarArb = fc.bigInt({ min: 1n, max: GROUP_ORDER - 1n });

describe('ristretto', () => {
  it('hash_to_curve_vectors', () => {
    for (const [input, output] of ELEMENT_DERIVATION_VECTORS) {
      expect(toHex(encodePoint(deriveElement(fromHex(input))))).toBe(output);
    }
    for (const input of SAME_ELEMENT_INPUTS) {
      expect(toHex(encodePoint(deriveElement(fromHex(input))))).toBe(SAME_ELEMENT_OUTPUT);
    }

    for (const [msg, uniform] of XMD_VECTORS) {
      expect(toHex(expandMessageXmd(utf8ToBytes(msg), XMD_DST, 32))).toBe(uniform);
    }
    // hashToGroup is exactly the composition of the two tested steps.
    const value = 'alice@example.com';
    expect(encodePoint(hashToGroup(value))).toEqual(
      encodePoint(deriveElement(expandMessageXmd(utf8ToBytes(value), PSI_DST, 64))),
    );
  });

  it('hash_to_group_is_domain_separated', () => {
    const a = encodePoint(hashToGroup('alice@example.com'));
    expect(encodePoint(hashToGroup('alice@example.com'))).toEqual(a);
    expect(encodePoint(hashToGroup('alice@example.com', 'some-other-app-v1'))).not.toEqual(a);
    expect(encodePoint(hashToGroup('alice@example.org'))).not.toEqual(a);
  });

  it('blinding_commutes', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), scalarArb, scalarArb, (value, a, b) => {
        const h = hashToGroup(value);
        const ab = encodePoint(multiply(multiply(h, a), b));
        const ba = encodePoint(multiply(multiply(h, b), a));
        expect(ab).toEqual(ba);
        // Through the wire encoding too, as the protocol does it.
        expect(encodePoint(multiply(decodePoint(encodePoint(multiply(h, a))), b))).toEqual(ab);
      }),
      { numRuns: 25 },
    );
  });

  it('pack_round_trips', () => {
    const points = ['a', 'b', 'c'].map((v) => hashToGroup(v));
    const packed = packPoints(points);
    expect(packed.length).toBe(96);
    expect(unpackPoints(packed).map((p, i) => p.equals(points[i]!))).toEqual([true, true, true]);
    expect(() => unpackPoints(new Uint8Array(33))).toThrow();
  });

  it('random_scalars_are_fresh_and_in_range', () => {
    const scalars = Array.from({ length: 32 }, randomScalar);
    expect(new Set(scalars).size).toBe(32);
    for (const s of scalars) expect(s > 0n && s < GROUP_ORDER).toBe(true);
  });
});
