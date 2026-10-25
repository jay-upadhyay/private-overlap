import { describe, expect, it } from 'vitest';
import { ProtocolError, type Envelope, type PartySpec } from '../protocol/types';
import { serializeError, type FromWorker, type ToWorker } from './messages';
import { relayRun, type PartyPort } from './relay';

/** A port whose "worker" is the test: it records what the relay posts and can reply. */
class FakePort implements PartyPort {
  readonly posted: { message: ToWorker; transfer: Transferable[] }[] = [];
  terminated = false;
  private onMessage?: (message: FromWorker) => void;
  private onCrash?: (error: Error) => void;

  post(message: ToWorker, transfer: Transferable[]) {
    this.posted.push({ message, transfer });
  }
  listen(onMessage: (message: FromWorker) => void, onCrash: (error: Error) => void) {
    this.onMessage = onMessage;
    this.onCrash = onCrash;
  }
  terminate() {
    this.terminated = true;
  }
  emit(message: FromWorker) {
    this.onMessage!(message);
  }
  crash(error: Error) {
    this.onCrash!(error);
  }
  delivered(): Envelope[] {
    return this.posted.flatMap(({ message }) => (message.kind === 'deliver' ? [message.envelope] : []));
  }
}

function setup(ids: string[], options: Parameters<typeof relayRun>[3] = {}) {
  const ports: Record<string, FakePort> = {};
  const parties: PartySpec<unknown>[] = ids.map((id) => ({ id, role: 'any', input: { secret: id } }));
  const run = relayRun<unknown>('toy', parties, (party) => (ports[party.id] = new FakePort()), options);
  return { ports, run };
}

const envelope = (from: string, to: string, type: string, payload: unknown, round = 0): Envelope => ({
  from,
  to,
  type,
  round,
  payload,
});

describe('runtime/relay', () => {
  it('sets_up_each_party_with_its_own_input', () => {
    const { ports } = setup(['a', 'b']);
    expect(ports.a!.posted[0]!.message).toEqual({
      kind: 'setup',
      protocolId: 'toy',
      partyId: 'a',
      role: 'any',
      input: { secret: 'a' },
    });
    expect(ports.b!.posted[0]!.message).toMatchObject({ partyId: 'b', input: { secret: 'b' } });
  });

  it('routes_envelopes_to_the_addressee_and_logs_them', async () => {
    const logged: string[] = [];
    const { ports, run } = setup(['a', 'b', 'c'], { onMessage: (e) => logged.push(`${e.from}->${e.to}`) });
    ports.a!.emit({ kind: 'send', envelope: envelope('a', 'c', 'hi', [1, 2], 3) });
    expect(ports.c!.delivered()).toEqual([envelope('a', 'c', 'hi', [1, 2], 3)]);
    expect(ports.b!.delivered()).toEqual([]);
    expect(logged).toEqual(['a->c']);

    for (const id of ['a', 'b', 'c']) ports[id]!.emit({ kind: 'done', output: id });
    const { results, wire } = await run;
    expect(results).toEqual({ a: 'a', b: 'b', c: 'c' });
    expect(wire).toEqual([{ seq: 0, from: 'a', to: 'c', type: 'hi', round: 3, bytes: 5, preview: '[1,2]' }]);
  });

  it('preserves_order_per_link', () => {
    const { ports } = setup(['a', 'b']);
    for (let i = 0; i < 20; i++) ports.a!.emit({ kind: 'send', envelope: envelope('a', 'b', 'n', i) });
    expect(ports.b!.delivered().map((e) => e.payload)).toEqual([...Array(20).keys()]);
  });

  it('records_binary_bytes_then_transfers_the_buffer', async () => {
    const { ports, run } = setup(['a', 'b']);
    const payload = new Uint8Array(4096).fill(7);
    ports.a!.emit({ kind: 'send', envelope: envelope('a', 'b', 'blob', payload) });
    const deliver = ports.b!.posted.at(-1)!;
    expect(deliver.transfer).toEqual([payload.buffer]);
    ports.a!.emit({ kind: 'done', output: null });
    ports.b!.emit({ kind: 'done', output: null });
    const { wire } = await run;
    expect(wire[0]).toMatchObject({ bytes: 4096, preview: `${'07'.repeat(16)}… (4096 bytes)` });
  });

  it('forwards_progress_with_the_party_id', () => {
    const progress: unknown[] = [];
    const { ports } = setup(['a'], { onProgress: (p) => progress.push(p) });
    ports.a!.emit({ kind: 'progress', fraction: 0.5, label: 'half' });
    expect(progress).toEqual([{ party: 'a', fraction: 0.5, label: 'half' }]);
  });

  it('one_party_failure_cancels_all_and_rejects', async () => {
    const { ports, run } = setup(['a', 'b']);
    ports.a!.emit({ kind: 'failed', error: serializeError(new ProtocolError('a broke')) });
    const error = await run.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error).toMatchObject({ message: 'a broke' });
    expect(ports.a!.terminated && ports.b!.terminated).toBe(true);
    expect(ports.b!.posted.at(-1)!.message).toMatchObject({ kind: 'cancel' });
  });

  it('worker_crash_rejects_run', async () => {
    const { ports, run } = setup(['a', 'b']);
    ports.b!.crash(new Error('script failed to load'));
    await expect(run).rejects.toThrow('script failed to load');
    expect(ports.a!.terminated).toBe(true);
  });

  it('abort_terminates_all_and_rejects_with_reason', async () => {
    const controller = new AbortController();
    const { ports, run } = setup(['a', 'b'], { signal: controller.signal });
    controller.abort(new Error('cancelled by user'));
    await expect(run).rejects.toThrow('cancelled by user');
    expect(Object.values(ports).every((p) => p.terminated)).toBe(true);
  });

  it('already_aborted_signal_spawns_nothing', async () => {
    const controller = new AbortController();
    controller.abort(new Error('too late'));
    const { ports, run } = setup(['a'], { signal: controller.signal });
    await expect(run).rejects.toThrow('too late');
    expect(ports).toEqual({});
  });

  it('messages_after_settling_are_ignored', async () => {
    const { ports, run } = setup(['a', 'b']);
    ports.a!.emit({ kind: 'failed', error: serializeError(new Error('first')) });
    ports.b!.emit({ kind: 'failed', error: serializeError(new Error('second')) });
    await expect(run).rejects.toThrow('first');
  });

  it('unknown_recipient_is_protocol_error', async () => {
    const { ports, run } = setup(['a']);
    ports.a!.emit({ kind: 'send', envelope: envelope('a', 'ghost', 'x', 1) });
    await expect(run).rejects.toBeInstanceOf(ProtocolError);
  });

  it('spoofed_sender_is_protocol_error', async () => {
    const { ports, run } = setup(['a', 'b']);
    ports.a!.emit({ kind: 'send', envelope: envelope('b', 'a', 'x', 1) });
    await expect(run).rejects.toThrow('claiming to be from b');
  });

  it('duplicate_party_ids_are_rejected', async () => {
    await expect(setup(['a', 'a']).run).rejects.toThrow('unique');
  });

  it('no_parties_resolves_empty', async () => {
    await expect(setup([]).run).resolves.toEqual({ results: {}, wire: [] });
  });
});
