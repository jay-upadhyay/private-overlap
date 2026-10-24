// Size and preview of a payload as it would cross the wire.

const PREVIEW_CHARS = 120;
const PREVIEW_BYTES = 16;

function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function bytesOf(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/** Binary payloads count raw bytes; anything else counts its UTF-8 JSON encoding. */
export function payloadBytes(payload: unknown): number {
  if (isBinary(payload)) return payload.byteLength;
  if (Array.isArray(payload) && payload.length > 0 && payload.every(isBinary)) {
    return payload.reduce((sum: number, b: ArrayBuffer | ArrayBufferView) => sum + b.byteLength, 0);
  }
  return new TextEncoder().encode(JSON.stringify(payload) ?? '').length;
}

export function payloadPreview(payload: unknown): string {
  if (isBinary(payload)) {
    const bytes = bytesOf(payload);
    const hex = [...bytes.slice(0, PREVIEW_BYTES)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return bytes.length > PREVIEW_BYTES ? `${hex}… (${bytes.length} bytes)` : hex;
  }
  const json = JSON.stringify(payload) ?? String(payload);
  return json.length > PREVIEW_CHARS ? `${json.slice(0, PREVIEW_CHARS)}…` : json;
}
