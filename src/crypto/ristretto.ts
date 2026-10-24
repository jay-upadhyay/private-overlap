// Thin wrappers over @noble/curves' ristretto255, the prime-order group the PSI stages use.
// Points cross the wire only as their canonical 32-byte encodings.

import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { expand_message_xmd } from '@noble/curves/abstract/hash-to-curve.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { packFixed, unpackFixed, utf8ToBytes } from './bytes';
import { randomBytes, secureSource, type RandomSource } from './random';

export type Point = InstanceType<typeof ristretto255.Point>;
export type Scalar = bigint;

export const POINT_BYTES = 32;

/** Order of the ristretto255 group. */
export const GROUP_ORDER: bigint = ristretto255.Point.Fn.ORDER;

/**
 * Domain-separation tag for hashing identifiers, in the RFC 9380 suite-ID style. A different
 * application (or a later version of this one) must use a different tag so its hashes never collide.
 */
export const PSI_DST = 'private-overlap-v1-PSI_ristretto255_XMD:SHA-512_R255MAP_RO_';

/** RFC 9380 §5.3.1 expand_message_xmd with SHA-512. */
export function expandMessageXmd(msg: Uint8Array, dst: string, lenInBytes: number): Uint8Array {
  return expand_message_xmd(msg, dst, lenInBytes, sha512);
}

/** RFC 9496 §4.3.4 element derivation: 64 uniform bytes to a group element. */
export function deriveElement(uniform: Uint8Array): Point {
  return ristretto255_hasher.deriveToCurve!(uniform);
}

/**
 * hash_to_ristretto255 (RFC 9380 Appendix B): expand_message_xmd(SHA-512) to 64 bytes, then
 * RFC 9496 element derivation. The input is a normalized identifier.
 */
export function hashToGroup(value: string, dst: string = PSI_DST): Point {
  return deriveElement(expandMessageXmd(utf8ToBytes(value), dst, 64));
}

/**
 * A uniformly random non-zero scalar, from the CSPRNG unless a test injects a source.
 * 64 random bytes reduced mod the group order, so the bias is negligible (about 2^-260).
 */
export function randomScalar(source: RandomSource = secureSource): Scalar {
  for (;;) {
    const bytes = randomBytes(64, source);
    let n = 0n;
    for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]!);
    const scalar = n % GROUP_ORDER;
    if (scalar !== 0n) return scalar;
  }
}

export function multiply(point: Point, scalar: Scalar): Point {
  return point.multiply(scalar);
}

export function encodePoint(point: Point): Uint8Array {
  return point.toBytes();
}

/** Throws on bytes that are not a canonical ristretto255 encoding. */
export function decodePoint(bytes: Uint8Array): Point {
  return ristretto255.Point.fromBytes(bytes);
}

/** N points as one N×32-byte buffer, so the wire log shows the real size. */
export function packPoints(points: readonly Point[]): Uint8Array {
  return packFixed(points.map(encodePoint), POINT_BYTES);
}

/** Decodes an N×32-byte buffer; throws if any entry is not a canonical encoding. */
export function unpackPoints(bytes: Uint8Array): Point[] {
  return unpackFixed(bytes, POINT_BYTES).map(decodePoint);
}
