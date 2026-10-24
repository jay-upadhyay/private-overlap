// Stage 3: the querier runs two-party PSI against each of 1–4 holders, with a fresh scalar and
// shuffle per session. Each holder still learns only a count, but the querier now learns,
// per customer, exactly which institutions flagged it: the attribution leak stage 4 addresses.

import type { MatchField } from '../../data/normalize';
import type { PartyId, Protocol } from '../../protocol/types';
import { prepareSet, type IdentifierRecord, type SkippedRecord } from './prepare';
import { querierSession, runHolder, type PsiHolderInput, type PsiHolderOutput } from './twoParty';

export interface MultiPsiOptions {
  /** 'parallel' (default) runs all sessions at once; 'sequential' runs them one after another. */
  mode?: 'parallel' | 'sequential';
}

export interface MultiPsiQuerierInput extends MultiPsiOptions {
  field: MatchField;
  records: readonly IdentifierRecord[];
  /** Holder party ids, 1–4. Grid entries list holders in this order. */
  holders: readonly PartyId[];
}

export type MultiPsiInput = MultiPsiQuerierInput | PsiHolderInput;

export interface MultiPsiQuerierOutput {
  role: 'querier';
  /** Flagged rowId -> ids of the holders that flagged it. Unflagged customers are absent. */
  grid: Record<string, PartyId[]>;
  /** Per holder: flagged rowIds (input order) and the size of that holder's list. */
  perHolder: Record<PartyId, { matches: string[]; holderSetSize: number }>;
  skipped: SkippedRecord[];
  sentCount: number;
}

export type MultiPsiOutput = MultiPsiQuerierOutput | PsiHolderOutput;

export const MAX_HOLDERS = 4;

export const multiPartyPsi: Protocol<MultiPsiInput, MultiPsiOutput> = {
  id: 'psi-mp',
  roles: ['querier', 'holder'],
  async run(role, input, ctx) {
    if (role === 'holder') return runHolder(input as PsiHolderInput, ctx);
    const { records, field, holders, mode = 'parallel' } = input as MultiPsiQuerierInput;
    if (holders.length < 1 || holders.length > MAX_HOLDERS) {
      throw new Error(`multi-party PSI needs 1–${MAX_HOLDERS} holders, got ${holders.length}`);
    }
    if (new Set(holders).size !== holders.length) throw new Error('holder ids must be distinct');
    const set = prepareSet(records, field);

    // querierSession draws its own scalar and shuffle, so sessions are independent either way.
    let sessions: Awaited<ReturnType<typeof querierSession>>[];
    if (mode === 'parallel') {
      sessions = await Promise.all(holders.map((h) => querierSession(ctx, h, set)));
    } else {
      sessions = [];
      for (const h of holders) sessions.push(await querierSession(ctx, h, set));
    }

    const grid: Record<string, PartyId[]> = {};
    const perHolder: MultiPsiQuerierOutput['perHolder'] = {};
    holders.forEach((h, i) => {
      const { matched, holderSetSize } = sessions[i]!;
      perHolder[h] = {
        matches: records.filter((r) => matched.has(r.rowId)).map((r) => r.rowId),
        holderSetSize,
      };
    });
    for (const record of records) {
      const by = holders.filter((_, i) => sessions[i]!.matched.has(record.rowId));
      if (by.length > 0) grid[record.rowId] = by;
    }
    ctx.progress(1, `${Object.keys(grid).length} flagged by at least one holder`);
    return { role: 'querier', grid, perHolder, skipped: set.skipped, sentCount: set.values.length };
  },
};
