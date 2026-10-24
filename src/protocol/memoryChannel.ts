import {
  ProtocolError,
  type Envelope,
  type PartyContext,
  type PartyId,
  type Progress,
  type WireEntry,
} from './types';
import { payloadBytes, payloadPreview } from './wire';

interface Waiter {
  resolve: (envelope: Envelope) => void;
  reject: (error: unknown) => void;
}

/**
 * In-process transport. Payloads are structured-cloned on send, as postMessage would,
 * so a protocol can never share memory with another party by accident.
 */
export class MemoryChannel {
  readonly wire: WireEntry[] = [];
  private readonly queues = new Map<string, Envelope[]>();
  private readonly waiters = new Map<string, Waiter>();
  private seq = 0;

  constructor(
    private readonly hooks: {
      onMessage?: (entry: WireEntry) => void;
      onProgress?: (progress: Progress) => void;
    } = {},
  ) {}

  private static link(from: PartyId, to: PartyId) {
    return `${from}->${to}`;
  }

  private deliver(envelope: Envelope) {
    const entry: WireEntry = {
      seq: this.seq++,
      from: envelope.from,
      to: envelope.to,
      type: envelope.type,
      round: envelope.round,
      bytes: payloadBytes(envelope.payload),
      preview: payloadPreview(envelope.payload),
    };
    this.wire.push(entry);
    this.hooks.onMessage?.(entry);

    const key = MemoryChannel.link(envelope.from, envelope.to);
    const waiter = this.waiters.get(key);
    if (waiter) {
      this.waiters.delete(key);
      waiter.resolve(envelope);
    } else {
      const queue = this.queues.get(key) ?? [];
      queue.push(envelope);
      this.queues.set(key, queue);
    }
  }

  private next(from: PartyId, to: PartyId, signal: AbortSignal): Promise<Envelope> {
    const key = MemoryChannel.link(from, to);
    const queued = this.queues.get(key)?.shift();
    if (queued) return Promise.resolve(queued);
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.waiters.has(key)) {
      return Promise.reject(new ProtocolError(`${to} is already waiting for ${from}`));
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.waiters.delete(key);
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.waiters.set(key, {
        resolve: (envelope) => {
          signal.removeEventListener('abort', onAbort);
          resolve(envelope);
        },
        reject,
      });
    });
  }

  context(self: PartyId, signal: AbortSignal): PartyContext {
    return {
      self,
      signal,
      send: (to, type, payload, round = 0) => {
        if (signal.aborted) throw signal.reason;
        this.deliver({ from: self, to, type, round, payload: structuredClone(payload) });
      },
      receive: async <T>(from: PartyId, type: string) => {
        const envelope = await this.next(from, self, signal);
        if (envelope.type !== type) {
          throw new ProtocolError(`${self} expected '${type}' from ${from} but got '${envelope.type}'`);
        }
        return envelope.payload as T;
      },
      progress: (fraction, label) => this.hooks.onProgress?.({ party: self, fraction, label }),
    };
  }
}
