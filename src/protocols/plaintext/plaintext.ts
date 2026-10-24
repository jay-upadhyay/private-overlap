import { extractIdentifiers } from '../../data/identifiers';
import {
  HOLDER_ROLE,
  QUERIER_ROLE,
  type HolderResult,
  type QuerierResult,
  type ScreeningInput,
  type ScreeningProtocol,
} from '../../protocol/screening';
import { ProtocolError, type PartyContext, type PartyId } from '../../protocol/types';

// Stage 0: the baseline every later stage improves on. Each holder sends its normalized
// banlist identifiers in the clear and the querier intersects them with its customers.
// Correct, and it hands the querier every holder's full banlist.

export const BANLIST_MESSAGE = 'banlist';

async function runHolder(input: ScreeningInput, ctx: PartyContext): Promise<HolderResult> {
  if (input.kind !== 'holder') throw new ProtocolError(`${ctx.self} has role holder but querier input`);
  const banlist = extractIdentifiers(input.records, input.field);
  ctx.send(input.querier, BANLIST_MESSAGE, banlist.values, 1);
  ctx.progress(1, 'Sent banlist');
  // The holder sees nothing of the querier's customers.
  return { kind: 'holder', screened: 0, skipped: banlist.skipped };
}

async function runQuerier(input: ScreeningInput, ctx: PartyContext): Promise<QuerierResult> {
  if (input.kind !== 'querier') throw new ProtocolError(`${ctx.self} has role querier but holder input`);
  const customers = extractIdentifiers(input.records, input.field);
  let received = 0;
  const banlists = await Promise.all(
    input.holders.map(async (holder) => {
      const values = await ctx.receive<string[]>(holder, BANLIST_MESSAGE);
      ctx.progress(++received / input.holders.length, `Received ${holder}'s banlist`);
      return new Set(values);
    }),
  );

  const flaggedBy: Record<string, PartyId[]> = {};
  customers.values.forEach((value, i) => {
    const by = input.holders.filter((_, h) => banlists[h]!.has(value));
    if (by.length > 0) flaggedBy[customers.rowIds[i]!] = by;
  });
  return { kind: 'querier', flaggedBy, skipped: customers.skipped };
}

export const plaintextProtocol: ScreeningProtocol = {
  id: 'plaintext',
  roles: [QUERIER_ROLE, HOLDER_ROLE],
  run(role, input, ctx) {
    if (role === QUERIER_ROLE) return runQuerier(input, ctx);
    if (role === HOLDER_ROLE) return runHolder(input, ctx);
    return Promise.reject(new ProtocolError(`plaintext has no role '${role}'`));
  },
};
