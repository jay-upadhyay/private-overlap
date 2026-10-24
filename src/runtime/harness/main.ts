import { buildPreset, type PresetId } from '../../data/presets';
import type { MatchField } from '../../data/normalize';
import { plaintextProtocol } from '../../protocols/plaintext/plaintext';
import { runInMemory } from '../../protocol/run';
import { screeningParties, type ScreeningInput } from '../../protocol/screening';
import type { PartySpec, WireEntry } from '../../protocol/types';
import { runInWorkers, spawnPartyWorker, workerPort } from '../runInWorkers';
import type { SpawnParty } from '../relay';

// Test hook for e2e/runtime.spec.ts: runs protocols in real Web Workers from the built app
// and returns plain data Playwright can compare. Not linked from the app.

export interface HarnessOutcome {
  ok: boolean;
  results?: unknown;
  wire?: WireEntry[];
  error?: { name: string; message: string };
  spawned: number;
  terminated: number;
}

/** Wraps a spawner to count how many workers were started and terminated. */
function counting(spawn: SpawnParty) {
  const counts = { spawned: 0, terminated: 0 };
  const wrapped: SpawnParty = (party) => {
    const port = spawn(party);
    counts.spawned++;
    return {
      ...port,
      terminate: () => {
        counts.terminated++;
        port.terminate();
      },
    };
  };
  return { counts, spawn: wrapped };
}

async function outcome(
  run: (spawn: SpawnParty) => Promise<{ results: unknown; wire: WireEntry[] }>,
  spawn: SpawnParty = spawnPartyWorker,
): Promise<HarnessOutcome> {
  const tracked = counting(spawn);
  try {
    const { results, wire } = await run(tracked.spawn);
    return { ok: true, results, wire, ...tracked.counts };
  } catch (e) {
    const error = e as Error;
    return { ok: false, error: { name: error.name, message: error.message }, ...tracked.counts };
  }
}

const harness = {
  async inMemory(preset: PresetId, field: MatchField) {
    const { results, wire } = await runInMemory(
      plaintextProtocol,
      screeningParties(buildPreset(preset), field),
    );
    return { results, wire };
  },

  inWorkers(preset: PresetId, field: MatchField) {
    const parties = screeningParties(buildPreset(preset), field);
    return outcome((spawn) => runInWorkers('plaintext', parties, { spawn }));
  },

  /** The querier waits for a holder that does not exist, so only cancelling ends the run. */
  cancelAfterFirstMessage() {
    const [querier, holder] = screeningParties(buildPreset('onboarding'), 'email');
    const input = querier!.input as Extract<ScreeningInput, { kind: 'querier' }>;
    const parties = [{ ...querier!, input: { ...input, holders: [holder!.id, 'ghost'] } }, holder!];
    const controller = new AbortController();
    return outcome((spawn) =>
      runInWorkers('plaintext', parties, {
        spawn,
        signal: controller.signal,
        onMessage: () => controller.abort(new Error('cancelled by user')),
      }),
    );
  },

  /** A party fails inside its worker: a role given the other role's input. */
  failInWorker() {
    const [querier, holder] = screeningParties(buildPreset('onboarding'), 'email');
    const parties: PartySpec<ScreeningInput>[] = [{ ...holder!, role: 'querier' }, querier!];
    return outcome((spawn) => runInWorkers('plaintext', parties, { spawn }));
  },

  /** A party's thrown TypeError, from input the protocol cannot read. */
  throwInWorker() {
    const [querier, holder] = screeningParties(buildPreset('onboarding'), 'email');
    const broken = {
      ...holder!,
      input: { ...holder!.input, records: null },
    } as unknown as PartySpec<ScreeningInput>;
    return outcome((spawn) => runInWorkers('plaintext', [querier!, broken], { spawn }));
  },

  /** The worker script itself fails to load. */
  crashWorker() {
    const parties = screeningParties(buildPreset('onboarding'), 'email');
    const missing: SpawnParty = () =>
      workerPort(new Worker(new URL('./missing-worker.js', document.baseURI), { type: 'module' }));
    return outcome((spawn) => runInWorkers('plaintext', parties, { spawn }), missing);
  },
};

declare global {
  interface Window {
    runtimeHarness?: typeof harness;
  }
}

window.runtimeHarness = harness;
document.getElementById('status')!.textContent = 'ready';
