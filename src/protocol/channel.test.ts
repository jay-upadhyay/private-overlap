import { describe, expect, it } from 'vitest';
import { MemoryChannel } from './memoryChannel';
import { runInMemory } from './run';
import { ProtocolError, type Protocol } from './types';
import { payloadBytes, payloadPreview } from './wire';

const live = () => new AbortController().signal;

/** Toy protocol: the querier sends each holder a list; holders reply with its length. */
const countProtocol: Protocol<string[] | null, number> = {
  id: 'count',
  roles: ['querier', 'holder'],
  async run(role, input, ctx) {
    if (role === 'querier') {
      const holders = input as unknown as string[];
      for (const h of holders) ctx.send(h, 'items', ['a', 'b', 'c'], 1);
      const counts = await Promise.all(holders.map((h) => ctx.receive<number>(h, 'count')));
      return counts.reduce((a, b) => a + b, 0);
    }
    const items = await ctx.receive<string[]>('q', 'items');
    ctx.progress(1, 'counted');
    ctx.send('q', 'count', items.length, 2);
    return items.length;
  },
};

describe('channel', () => {
  it('logs_every_message', async () => {
    const { wire } = await runInMemory(countProtocol, [
      { id: 'q', role: 'querier', input: ['h1', 'h2'] },
      { id: 'h1', role: 'holder', input: null },
      { id: 'h2', role: 'holder', input: null },
    ]);
    expect(wire).toHaveLength(4);
    expect(wire.map((w) => [w.from, w.to, w.type, w.round])).toEqual(
      expect.arrayContaining([
        ['q', 'h1', 'items', 1],
        ['q', 'h2', 'items', 1],
        ['h1', 'q', 'count', 2],
        ['h2', 'q', 'count', 2],
      ]),
    );
    expect(wire.find((w) => w.type === 'items')!.bytes).toBe('["a","b","c"]'.length);
    expect(wire.map((w) => w.seq)).toEqual([0, 1, 2, 3]);
  });

  it('preserves_order_per_link', async () => {
    const channel = new MemoryChannel();
    const a = channel.context('a', live());
    const b = channel.context('b', live());
    for (let i = 0; i < 50; i++) a.send('b', 'n', i);
    const got: number[] = [];
    for (let i = 0; i < 50; i++) got.push(await b.receive<number>('a', 'n'));
    expect(got).toEqual([...Array(50).keys()]);
  });

  it('receive_before_send_waits', async () => {
    const channel = new MemoryChannel();
    const pending = channel.context('b', live()).receive<string>('a', 'hello');
    channel.context('a', live()).send('b', 'hello', 'world');
    await expect(pending).resolves.toBe('world');
  });

  it('type_mismatch_is_protocol_error', async () => {
    const channel = new MemoryChannel();
    channel.context('a', live()).send('b', 'x', 1);
    await expect(channel.context('b', live()).receive('a', 'y')).rejects.toBeInstanceOf(ProtocolError);
  });

  it('payload_is_cloned_on_send', async () => {
    const channel = new MemoryChannel();
    const data = { list: [1, 2, 3] };
    channel.context('a', live()).send('b', 'd', data);
    data.list.push(4);
    await expect(channel.context('b', live()).receive('a', 'd')).resolves.toEqual({ list: [1, 2, 3] });
  });

  it('binary_payload_size_and_preview', () => {
    const bytes = new Uint8Array(64).map((_, i) => i);
    expect(payloadBytes(bytes)).toBe(64);
    expect(payloadBytes([bytes, bytes.subarray(0, 32)])).toBe(96);
    expect(payloadPreview(bytes)).toBe('000102030405060708090a0b0c0d0e0f… (64 bytes)');
    expect(payloadPreview('x'.repeat(500)).length).toBeLessThanOrEqual(121);
  });

  it('cancel_rejects_pending_receive', async () => {
    const controller = new AbortController();
    const channel = new MemoryChannel();
    const pending = channel.context('b', controller.signal).receive('a', 'never');
    controller.abort(new Error('stop'));
    await expect(pending).rejects.toThrow('stop');
  });

  it('cancel_stops_run', async () => {
    const controller = new AbortController();
    const hang: Protocol<null, never> = {
      id: 'hang',
      roles: ['x'],
      run: (_role, _input, ctx) => ctx.receive('nobody', 'never'),
    };
    const run = runInMemory(hang, [{ id: 'a', role: 'x', input: null }], { signal: controller.signal });
    controller.abort(new Error('cancelled by user'));
    await expect(run).rejects.toThrow('cancelled by user');
  });

  it('one_party_failure_stops_the_rest', async () => {
    const failing: Protocol<null, unknown> = {
      id: 'fail',
      roles: ['bad', 'waiter'],
      async run(role, _input, ctx) {
        if (role === 'bad') throw new Error('boom');
        return ctx.receive('bad', 'never');
      },
    };
    await expect(
      runInMemory(failing, [
        { id: 'bad', role: 'bad', input: null },
        { id: 'w', role: 'waiter', input: null },
      ]),
    ).rejects.toThrow('boom');
  });

  it('reports_progress_and_results', async () => {
    const progress: string[] = [];
    const { results } = await runInMemory(
      countProtocol,
      [
        { id: 'q', role: 'querier', input: ['h1'] },
        { id: 'h1', role: 'holder', input: null },
      ],
      { onProgress: (p) => progress.push(`${p.party}:${p.fraction}:${p.label}`) },
    );
    expect(results).toEqual({ q: 3, h1: 3 });
    expect(progress).toEqual(['h1:1:counted']);
  });

  it('rejects_unknown_role', async () => {
    await expect(runInMemory(countProtocol, [{ id: 'z', role: 'spy', input: null }])).rejects.toThrow(
      "no role 'spy'",
    );
  });
});
