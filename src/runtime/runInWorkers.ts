import type { RunOptions, RunResult } from '../protocol/run';
import type { PartySpec } from '../protocol/types';
import type { FromWorker } from './messages';
import type { OutputOf, PartiesOf, ProtocolId } from './registry';
import { relayRun, type PartyPort, type SpawnParty } from './relay';

export interface WorkerRunOptions extends RunOptions {
  /** How to start each party. Defaults to one module Web Worker per party. */
  spawn?: SpawnParty;
}

/** Adapts a Web Worker to a PartyPort. */
export function workerPort(worker: Worker): PartyPort {
  return {
    post: (message, transfer) => worker.postMessage(message, transfer),
    listen: (onMessage, onCrash) => {
      worker.onmessage = (event: MessageEvent<FromWorker>) => onMessage(event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        onCrash(new Error(`worker crashed: ${event.message || 'script failed to load'}`));
      };
      worker.onmessageerror = () => onCrash(new Error('worker sent a message that could not be decoded'));
    },
    terminate: () => worker.terminate(),
  };
}

/** One module worker per party. Vite bundles the worker and resolves its URL against the page's base. */
export const spawnPartyWorker: SpawnParty = (party: PartySpec<unknown>) =>
  workerPort(
    new Worker(new URL('./party.worker.ts', import.meta.url), { type: 'module', name: `party ${party.id}` }),
  );

/**
 * Runs each party of a registered protocol in its own Web Worker, relaying messages through
 * the main thread. Same contract as runInMemory, so callers can switch transports freely.
 */
export function runInWorkers<K extends ProtocolId>(
  protocolId: K,
  parties: PartiesOf<K>,
  options: WorkerRunOptions = {},
): Promise<RunResult<OutputOf<K>>> {
  const { spawn = spawnPartyWorker, ...runOptions } = options;
  return relayRun<OutputOf<K>>(protocolId, parties, spawn, runOptions);
}
