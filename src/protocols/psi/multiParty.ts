// Stage 3: the querier runs two-party PSI against each of 1–4 holders, with a fresh scalar and
// shuffle per session. Each holder still learns only a count, but the querier now learns,
// per customer, exactly which institutions flagged it: the attribution leak stage 4 addresses.

import { createPsiProtocol, type PsiProtocolOptions } from './screening';

export const MAX_HOLDERS = 4;

export function createMultiPartyPsi(options: Pick<PsiProtocolOptions, 'mode' | 'source'> = {}) {
  return createPsiProtocol({ id: 'psi-mp', maxHolders: MAX_HOLDERS, ...options });
}

export const multiPartyPsi = createMultiPartyPsi();
