# Future work

Scoped out on purpose for the take-home, in the interest of time. Each is described in
[DESIGN.md](DESIGN.md) under Limitations or Extensions.

**Done during the project**

- Stage 1 attack on the hashing page.
- Stage 2 and 3 attack panels on the PSI pages (`src/ui/attackRunners.ts`).

**Not done**

- **Stage 3 attribution panel.** The leak (which institution flagged whom) is already shown in the
  results table, in "What just happened" and on the summary page; a dedicated attacker-panel view
  of it was not built.
- **Stage 4 attack panels.** Stage 4 is marked out of scope for attacks. The budget refusals that
  stop bulk probing and repeated scoring are shown on the page and tested.
- **Per-customer DP cap keying.** The cap is keyed by the querier's own row ids
  (`customerKeys` in `src/ui/dpBudget.ts`), so it holds only for an honest querier. Accepted as a
  limitation; a coordinator-side key would need a different protocol design.
- **Benchmarks (phase P9).** A benchmark page, a worker pool inside each party, and a WASM curve
  library. Deferred because the theme rewards understanding over speed; the run-time estimate and
  the summary's run-time row already show what privacy costs.
