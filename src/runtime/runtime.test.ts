import { describe, expect, it } from 'vitest';
import { plaintextProtocol } from '../protocols/plaintext/plaintext';
import { runInMemory } from '../protocol/run';
import { screeningParties } from '../protocol/screening';
import { ProtocolError, type PartySpec, type Protocol, type WireEntry } from '../protocol/types';
import { smallScenario } from '../test/fixtures';
import { loopbackSpawn } from './loopback';
import type { FromWorker } from './messages';
import { createPartyContext, Inbox } from './partyContext';
import { PROTOCOLS, type ProtocolRegistry } from './registry';
import { relayRun, type SpawnParty } from './relay';
import { runInWorkers } from './runInWorkers';

// These run the real worker code behind MessageChannels (loopback), so payloads are
// structured-cloned and buffers transferred as in the browser. e2e/runtime.spec.ts runs
// the same paths in real Web Workers.

const toy: Protocol<null, unknown> = {
  id: 'toy',
  roles: ['sender', 'receiver', 'mismatch', 'thrower', 'waiter', 'binary', 'keeper'],
  async run(role, _input, ctx) {
    switch (role) {
      case 'sender':
        for (let i = 0; i < 30; i++) ctx.send('r', 'n', i, i);
        return 'sent';
      case 'receiver': {
        const got: number[] = [];
        for (let i = 0; i < 30; i++) got.push(await ctx.receive<number>('s', 'n'));
        return got;
      }
      case 'mismatch':
        return ctx.receive('s', 'not-n');
      case 'thrower':
        throw new Error('boom');
      case 'waiter':
        return ctx.receive('nobody', 'never');
      case 'binary': {
        const bytes = new Uint8Array(1 << 16).map((_, i) => i % 251);
        ctx.send('k', 'blob', bytes);
        // The sender still owns its buffer after sending, as on the in-memory channel.
        return bytes.byteLength;
      }
      case 'keeper': {
        const bytes = await ctx.receive<Uint8Array>('b', 'blob');
        return [bytes.byteLength, bytes[1000]];
      }
    }
  },
};

const registry: ProtocolRegistry = { ...PROTOCOLS, toy };
const spawn = loopbackSpawn(registry);
const party = (id: string, role: string): PartySpec<null> => ({ id, role, input: null });
const shape = (wire: WireEntry[]) =>
  wire
    .map(({ from, to, type, round, bytes, preview }) => [from, to, type, round, bytes, preview].join('|'))
    .sort();

describe('runtime', () => {
  it('run_in_workers_equals_run_in_memory', async () => {
    const scenario = smallScenario({ holders: 3, banlistSize: 150, flaggedByCount: [0.1, 0.05, 0.02] });
    const parties = screeningParties(scenario, 'email');
    const memory = await runInMemory(plaintextProtocol, parties);
    const workers = await runInWorkers('plaintext', parties, { spawn });
    expect(workers.results).toEqual(memory.results);
    expect(shape(workers.wire)).toEqual(shape(memory.wire));
    expect(workers.wire.map((w) => w.seq)).toEqual(workers.wire.map((_, i) => i));
  });

  it('preserves_order_per_link', async () => {
    const { results, wire } = await relayRun('toy', [party('s', 'sender'), party('r', 'receiver')], spawn);
    expect(results.r).toEqual([...Array(30).keys()]);
    expect(wire.map((w) => w.round)).toEqual([...Array(30).keys()]);
  });

  it('type_mismatch_is_protocol_error', async () => {
    const run = relayRun('toy', [party('s', 'sender'), party('r', 'mismatch')], spawn);
    await expect(run).rejects.toBeInstanceOf(ProtocolError);
    await expect(run).rejects.toThrow("r expected 'not-n' from s but got 'n'");
  });

  it('one_party_failure_stops_the_rest', async () => {
    await expect(relayRun('toy', [party('t', 'thrower'), party('w', 'waiter')], spawn)).rejects.toThrow(
      'boom',
    );
  });

  it('cancel_stops_run', async () => {
    const controller = new AbortController();
    const run = relayRun('toy', [party('w', 'waiter')], spawn, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error('cancelled by user')), 10);
    await expect(run).rejects.toThrow('cancelled by user');
  });

  it('binary_payload_is_measured_and_moved', async () => {
    const { results, wire } = await relayRun('toy', [party('b', 'binary'), party('k', 'keeper')], spawn);
    expect(results).toEqual({ b: 1 << 16, k: [1 << 16, 1000 % 251] });
    expect(wire).toMatchObject([{ type: 'blob', bytes: 1 << 16 }]);
  });

  it('unknown_protocol_or_role_rejects', async () => {
    await expect(relayRun('nope', [party('a', 'x')], spawn)).rejects.toThrow("unknown protocol 'nope'");
    await expect(relayRun('toy', [party('a', 'spy')], spawn)).rejects.toThrow("no role 'spy'");
  });

  it('worker_posts_back_only_envelopes_progress_and_outcome', async () => {
    const scenario = smallScenario();
    const posted: FromWorker[] = [];
    const recording: SpawnParty = (p) => {
      const port = spawn(p);
      return {
        ...port,
        listen: (onMessage, onCrash) => port.listen((m) => (posted.push(m), onMessage(m)), onCrash),
      };
    };
    await runInWorkers('plaintext', screeningParties(scenario, 'email'), { spawn: recording });
    const querierRecords = JSON.stringify(scenario.querier.records[0]);
    expect(new Set(posted.map((m) => m.kind))).toEqual(new Set(['send', 'progress', 'done']));
    expect(posted.some((m) => JSON.stringify(m).includes(querierRecords))).toBe(false);
  });
});

describe('runtime/partyContext', () => {
  const contexts = () => {
    const inbox = new Inbox();
    const signal = new AbortController().signal;
    const b = createPartyContext('b', signal, inbox, { post: () => {}, progress: () => {} });
    return { inbox, b };
  };

  it('receive_before_push_waits', async () => {
    const { inbox, b } = contexts();
    const pending = b.receive<string>('a', 'hello');
    inbox.push({ from: 'a', to: 'b', type: 'hello', round: 0, payload: 'world' });
    await expect(pending).resolves.toBe('world');
  });

  it('second_concurrent_receive_from_same_sender_is_protocol_error', async () => {
    const { b } = contexts();
    void b.receive('a', 'x');
    await expect(b.receive('a', 'x')).rejects.toBeInstanceOf(ProtocolError);
  });

  it('abort_rejects_pending_receive_and_send', async () => {
    const controller = new AbortController();
    const ctx = createPartyContext('b', controller.signal, new Inbox(), {
      post: () => {},
      progress: () => {},
    });
    const pending = ctx.receive('a', 'x');
    controller.abort(new Error('stop'));
    await expect(pending).rejects.toThrow('stop');
    expect(() => ctx.send('a', 'x', 1)).toThrow('stop');
  });
});
