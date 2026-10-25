// PSI as a ScreeningProtocol: the querier runs one session per holder, each with a fresh
// scalar and shuffle, and reports which holders flagged each customer. Each holder answers
// one session and learns only how many values it screened.

import { secureSource, type RandomSource } from '../../crypto/random';
import {
  HOLDER_ROLE,
  QUERIER_ROLE,
  type HolderInput,
  type QuerierInput,
  type QuerierResult,
  type ScreeningProtocol,
} from '../../protocol/screening';
import type { PartyId } from '../../protocol/types';
import { holderSession, prepareSet, querierSession } from './session';

export interface PsiProtocolOptions {
  id: string;
  /** Most holders the querier may run against. */
  maxHolders: number;
  /** 'parallel' (default) runs all sessions at once; 'sequential' runs them one after another. */
  mode?: 'parallel' | 'sequential';
  /** Secret randomness; tests may inject a seeded source. */
  source?: RandomSource;
}

export function createPsiProtocol(options: PsiProtocolOptions): ScreeningProtocol {
  const { id, maxHolders, mode = 'parallel', source = secureSource } = options;
  return {
    id,
    roles: [QUERIER_ROLE, HOLDER_ROLE],
    async run(role, input, ctx) {
      if (role === HOLDER_ROLE) {
        const { records, field, querier } = input as HolderInput;
        const set = prepareSet(records, field);
        const screened = await holderSession(ctx, querier, set, source);
        return { kind: 'holder', screened, skipped: set.skipped };
      }

      const { records, field, holders } = input as QuerierInput;
      if (holders.length < 1 || holders.length > maxHolders) {
        throw new Error(`${id} needs 1–${maxHolders} holders, got ${holders.length}`);
      }
      if (new Set(holders).size !== holders.length) throw new Error('holder ids must be distinct');
      const set = prepareSet(records, field);

      let sessions: Set<string>[];
      if (mode === 'parallel') {
        sessions = (await Promise.all(holders.map((h) => querierSession(ctx, h, set, source)))).map(
          (s) => s.matched,
        );
      } else {
        sessions = [];
        for (const h of holders) sessions.push((await querierSession(ctx, h, set, source)).matched);
      }

      const flaggedBy: QuerierResult['flaggedBy'] = {};
      for (const record of records) {
        const by: PartyId[] = holders.filter((_, i) => sessions[i]!.has(record.rowId));
        if (by.length > 0) flaggedBy[record.rowId] = by;
      }
      ctx.progress(1, `${Object.keys(flaggedBy).length} flagged`);
      return { kind: 'querier', flaggedBy, skipped: set.skipped };
    },
  };
}
