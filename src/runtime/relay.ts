import type { RunOptions, RunResult } from '../protocol/run';
import { ProtocolError, type PartyId, type PartySpec, type WireEntry } from '../protocol/types';
import { payloadBytes, payloadPreview } from '../protocol/wire';
import { deserializeError, serializeError, transferables, type FromWorker, type ToWorker } from './messages';

/** The main thread's side of its link to one party, usually a Web Worker. */
export interface PartyPort {
  post(message: ToWorker, transfer: Transferable[]): void;
  /** `onCrash` is for failures outside the protocol, such as a worker script that fails to load. */
  listen(onMessage: (message: FromWorker) => void, onCrash: (error: Error) => void): void;
  terminate(): void;
}

export type SpawnParty = (party: PartySpec<unknown>) => PartyPort;

const cancelled = () => new DOMException('Run cancelled', 'AbortError');

/**
 * Runs every party on its own port and relays envelopes between them, logging each one
 * on the wire. Same contract as runInMemory: results by party id, or a rejection with the
 * first party's error (or the abort reason), after which every port is terminated.
 */
export function relayRun<O>(
  protocolId: string,
  parties: readonly PartySpec<unknown>[],
  spawn: SpawnParty,
  options: RunOptions = {},
): Promise<RunResult<O>> {
  const { signal, onMessage, onProgress } = options;
  const wire: WireEntry[] = [];
  const ports = new Map<PartyId, PartyPort>();
  const outputs = new Map<PartyId, O>();

  return new Promise<RunResult<O>>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      for (const port of ports.values()) {
        if (error !== undefined) {
          try {
            port.post({ kind: 'cancel', reason: serializeError(error) }, []);
          } catch {
            // The port may already be gone; terminating it is what matters.
          }
        }
        port.terminate();
      }
      if (error !== undefined) return reject(error);
      const results: Record<PartyId, O> = {};
      for (const party of parties) results[party.id] = outputs.get(party.id)!;
      resolve({ results, wire });
    };
    const abort = () => finish(signal?.reason ?? cancelled());

    const relay = (from: PartyId, message: FromWorker) => {
      switch (message.kind) {
        case 'send': {
          const { envelope } = message;
          if (envelope.from !== from) {
            throw new ProtocolError(`${from} sent an envelope claiming to be from ${envelope.from}`);
          }
          const target = ports.get(envelope.to);
          if (!target)
            throw new ProtocolError(`${from} sent '${envelope.type}' to unknown party ${envelope.to}`);
          // Measure before transferring: the payload's buffers are detached once forwarded.
          const entry: WireEntry = {
            seq: wire.length,
            from: envelope.from,
            to: envelope.to,
            type: envelope.type,
            round: envelope.round,
            bytes: payloadBytes(envelope.payload),
            preview: payloadPreview(envelope.payload),
          };
          wire.push(entry);
          onMessage?.(entry);
          target.post({ kind: 'deliver', envelope }, transferables(envelope.payload));
          break;
        }
        case 'progress':
          onProgress?.({ party: from, fraction: message.fraction, label: message.label });
          break;
        case 'done':
          outputs.set(from, message.output as O);
          if (outputs.size === parties.length) finish();
          break;
        case 'failed':
          finish(deserializeError(message.error));
          break;
      }
    };

    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (new Set(parties.map((p) => p.id)).size !== parties.length) {
      return finish(new Error('party ids must be unique'));
    }
    if (parties.length === 0) return finish();

    try {
      for (const party of parties) {
        const port = spawn(party);
        ports.set(party.id, port);
        port.listen(
          (message) => {
            if (settled) return;
            try {
              relay(party.id, message);
            } catch (error) {
              finish(error);
            }
          },
          (error) => finish(error),
        );
      }
      // Every port exists before any party starts, so the first envelope always has a route.
      for (const party of parties) {
        ports
          .get(party.id)!
          .post({ kind: 'setup', protocolId, partyId: party.id, role: party.role, input: party.input }, []);
      }
    } catch (error) {
      finish(error);
    }
  });
}
