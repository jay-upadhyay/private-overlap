# Backlog

Tasks left for the author to finish before submission. Claude adds to this list as items come up.

- [x] **Stage 1 attack (hashing page).** Done. Finish the preimage search on branch `wave2-hashing-preimage`:
      `src/attacks/preimage/preimageSearch.ts` and `phoneRangeCandidates` in `src/attacks/candidates.ts`
      are done; `preimageSearch.test.ts` is partial and does not compile. Then merge and set
      `runAttack` for the `hashing` stage in `src/stages.ts`.
- [x] **Stage 2 and 3 attack panels (PSI pages).** Done: `src/ui/attackRunners.ts`. The fishing code is on `main` in
      `src/attacks/fishing/` (`runFishing`, `runMultiFishing`, `scoreFishing`) with passing tests.
      Wire it into `runAttack` for the `psi` and `multi-psi` stages.
- [ ] **Stage 3 attribution panel.** Show that multi-party PSI tells the querier which institution
      flagged each customer (the results grid already shows it; the attack panel does not).
- [ ] **Stage 4 attack panels (DP page).** Show the earlier attacks failing against noisy scores and
      the budget ledger.
- [ ] **Per-customer DP cap.** The page's ledger enforces the lifetime cap per customer, keyed by
      the querier's own row ids (`customerKeys` in `src/ui/dpBudget.ts`). That only holds for an
      honest querier: the coordinator sees freshly blinded points each run, so it has no stable key
      of its own. Decide whether to accept this (and say so on the page) or redesign the keying.
