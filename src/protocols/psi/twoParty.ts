// Stage 2: two-party Diffie–Hellman PSI on ristretto255 (protocol in session.ts).
// The querier learns which customers one holder flags; the holder learns only a count.

import { createPsiProtocol } from './screening';

export const twoPartyPsi = createPsiProtocol({ id: 'psi-2p', maxHolders: 1 });
