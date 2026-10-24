import type { PartyId, Protocol } from '../../protocol/types';

/** A message as an eavesdropper would capture it, payload included. */
export interface TappedMessage {
  from: PartyId;
  to: PartyId;
  type: string;
  payload: unknown;
}

/**
 * Wraps a protocol so every payload a party sends is also recorded. The wire log from
 * runInMemory keeps only sizes and previews; attack tests need the full bytes.
 */
export function tapProtocol<I, O>(
  protocol: Protocol<I, O>,
): { protocol: Protocol<I, O>; messages: TappedMessage[] } {
  const messages: TappedMessage[] = [];
  return {
    messages,
    protocol: {
      ...protocol,
      run: (role, input, ctx) =>
        protocol.run(role, input, {
          ...ctx,
          self: ctx.self,
          signal: ctx.signal,
          send(to, type, payload, round) {
            messages.push({ from: ctx.self, to, type, payload: structuredClone(payload) });
            ctx.send(to, type, payload, round);
          },
          receive: (from, type) => ctx.receive(from, type),
          progress: (fraction, label) => ctx.progress(fraction, label),
        }),
    },
  };
}

/** Every binary payload in the capture, flattened to byte arrays. */
export function capturedBytes(messages: readonly TappedMessage[]): Uint8Array[] {
  // ArrayBuffer.isView rather than instanceof: cloned payloads may come from another realm.
  return messages.flatMap((m) => {
    const p = m.payload;
    return ArrayBuffer.isView(p) ? [new Uint8Array(p.buffer, p.byteOffset, p.byteLength)] : [];
  });
}
