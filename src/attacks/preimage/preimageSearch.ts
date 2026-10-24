import { bytesToHex, unpackFixed } from '../../crypto/bytes';
import { hashIdentifier, HASH_BYTES } from '../../crypto/sha256';

// Preimage search over a candidate space.
//
// A cryptographic hash cannot be inverted, but it does not need to be when the inputs
// are guessable. Emails, phone numbers and public wallet addresses come from small,
// structured spaces, so an observer can:
//   1. index every observed hash in a hash table (O(1) lookup),
//   2. enumerate candidate identifiers from that space,
//   3. hash each candidate with the same function and look it up,
//   4. record each hit as a recovered preimage.
// Cost is one hash per candidate, independent of how many targets there are, and the
// search stops as soon as every target is recovered. With a keyed hash (HMAC) the same
// search works only for someone who holds the key.

export interface PreimageSearchOptions {
  /** The function the target hashes were made with. Default: unsalted SHA-256. */
  hash?: (candidate: string) => Uint8Array;
  signal?: AbortSignal;
  /** Called every `progressEvery` candidates with the number tried so far. */
  onProgress?: (tried: number, recovered: number) => void;
  progressEvery?: number;
}

export interface PreimageSearchResult {
  /** Recovered identifiers, in the order they were found. */
  recovered: string[];
  /** Hex hash -> recovered identifier. */
  preimages: Map<string, string>;
  /** Number of distinct target hashes. */
  targets: number;
  /** Candidates hashed before the search ended. */
  tried: number;
  elapsedMs: number;
}

/** Targets may be a packed N×32-byte wire payload or a list of 32-byte hashes. */
export function preimageSearch(
  targets: Uint8Array | readonly Uint8Array[],
  candidates: Iterable<string>,
  options: PreimageSearchOptions = {},
): PreimageSearchResult {
  const hash = options.hash ?? hashIdentifier;
  const progressEvery = options.progressEvery ?? 10_000;
  const list = targets instanceof Uint8Array ? unpackFixed(targets, HASH_BYTES) : targets;

  // Step 1: index the targets.
  const pending = new Set(list.map(bytesToHex));
  const total = pending.size;
  const preimages = new Map<string, string>();
  const recovered: string[] = [];
  const start = performance.now();
  let tried = 0;

  // Steps 2-4: enumerate, hash, look up.
  for (const candidate of candidates) {
    if (pending.size === 0) break;
    const key = bytesToHex(hash(candidate));
    tried++;
    if (pending.delete(key)) {
      preimages.set(key, candidate);
      recovered.push(candidate);
    }
    if (tried % progressEvery === 0) {
      options.signal?.throwIfAborted();
      options.onProgress?.(tried, recovered.length);
    }
  }
  options.onProgress?.(tried, recovered.length);

  return { recovered, preimages, targets: total, tried, elapsedMs: performance.now() - start };
}
