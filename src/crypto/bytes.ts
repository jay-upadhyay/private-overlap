// Byte helpers. Generic ones come from @noble/hashes; this file only adds
// fixed-width packing, so a batch of N hashes or points crosses the wire as one
// N×width buffer and the wire log shows its true size.

export { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export function packFixed(items: readonly Uint8Array[], width: number): Uint8Array {
  const out = new Uint8Array(items.length * width);
  items.forEach((item, i) => {
    if (item.length !== width) throw new RangeError(`item ${i} is ${item.length} bytes, expected ${width}`);
    out.set(item, i * width);
  });
  return out;
}

/** Views into `packed`; copy them if the buffer will be reused. */
export function unpackFixed(packed: Uint8Array, width: number): Uint8Array[] {
  if (packed.length % width !== 0)
    throw new RangeError(`${packed.length} bytes is not a multiple of ${width}`);
  const items: Uint8Array[] = [];
  for (let i = 0; i < packed.length; i += width) items.push(packed.subarray(i, i + width));
  return items;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
