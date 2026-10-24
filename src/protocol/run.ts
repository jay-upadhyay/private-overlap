import { MemoryChannel } from './memoryChannel';
import type { PartyId, PartySpec, Progress, Protocol, WireEntry } from './types';

export interface RunOptions {
  signal?: AbortSignal;
  onMessage?: (entry: WireEntry) => void;
  onProgress?: (progress: Progress) => void;
}

export interface RunResult<O> {
  results: Record<PartyId, O>;
  wire: WireEntry[];
}

/**
 * Runs every party of a protocol concurrently on an in-memory channel.
 * If any party fails or the caller aborts, all parties are cancelled.
 */
export async function runInMemory<I, O>(
  protocol: Protocol<I, O>,
  parties: readonly PartySpec<I>[],
  options: RunOptions = {},
): Promise<RunResult<O>> {
  for (const party of parties) {
    if (!protocol.roles.includes(party.role)) {
      throw new Error(`protocol ${protocol.id} has no role '${party.role}'`);
    }
  }
  const controller = new AbortController();
  const abort = () =>
    controller.abort(options.signal?.reason ?? new DOMException('Run cancelled', 'AbortError'));
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });

  const channel = new MemoryChannel({ onMessage: options.onMessage, onProgress: options.onProgress });
  try {
    const outputs = await Promise.all(
      parties.map((party) =>
        protocol.run(party.role, party.input, channel.context(party.id, controller.signal)).catch((error) => {
          // Stop the other parties rather than leaving them waiting forever.
          if (!controller.signal.aborted) controller.abort(error);
          throw error;
        }),
      ),
    );
    const results: Record<PartyId, O> = {};
    parties.forEach((party, i) => (results[party.id] = outputs[i]!));
    return { results, wire: channel.wire };
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
}
