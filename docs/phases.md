# Private Overlap — Implementation Phases

Oct 24, 2026 · @Jay

> Exported from the project's planning documents on 2026-10-24. The status section is final; the sections after it are the original plan, kept as written, so they still say what was intended at the time.

## Status

As of Oct 24, 2026: P0–P8 and P10 are done and live at [jay-upadhyay.github.io/private-overlap](https://jay-upadhyay.github.io/private-overlap/); P9 benchmarks were deferred. The final build has 251 unit tests and 42 browser tests, all green in CI, including against the live site. Code: [github.com/jay-upadhyay/private-overlap](https://github.com/jay-upadhyay/private-overlap).

| Phase                     | Status   | How it ended                                                                                                              |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| P0 Scaffold and deploy    | Done     | As planned; CI also reruns the browser tests against the live URL                                                         |
| P1 Synthetic data         | Done     | Also took the protocol contract and a shared kit of crypto, data and test helpers, so wave 2 could run in parallel        |
| P2 Worker runtime         | Done     | Built in a parallel session                                                                                               |
| P3 UI shell               | Done     | Built in a parallel session                                                                                               |
| P4 Hashing                | Done     | Protocol in a parallel session; the stage 1 attack finished by the author                                                 |
| P5 Two-party PSI          | Done     | Built in a parallel session; the attack panel wired by the author                                                         |
| P6 Multi-party PSI        | Done     | Built in a parallel session; a dedicated attribution panel was scoped out, as the leak shows in results and the summary   |
| P7 DP risk scores         | Done     | Added an ε slider, a tier-accuracy chart, custom sizes and a run-time estimate; stage 4 attack panels scoped out          |
| P8 Polish and walkthrough | Done     | Added theory pages with live worked examples and references, plain-language run explanations, and a like-for-like summary |
| P9 Benchmarks             | Deferred | Deferred: the theme rewards understanding over speed                                                                      |
| P10 Submission            | Done     | README and DESIGN.md written; video and transcript review with the author                                                 |

Scoped-out items are listed in the repo's FUTURE\_WORK.md.

## Use case

The demo follows one story: a crypto exchange screens its customers against banlists held by other exchanges, brokers and banks, without seeing those lists and without revealing its own customers. This is a strong use case because both sides have real reasons to keep their data private. Customer lists are competitive. Banlists carry legal risk for whoever shares them.

**Parties in every scenario**

- **Querier:** an exchange or broker that wants to know which of its customers are flagged elsewhere.
- **Banlist holders:** 1–4 other institutions, each with a private list of flagged identities and a reason (fraud, chargeback abuse, AML hold, sanctions-like match).
- **Coordinator:** a neutral consortium service, used only in stage 4.

**Identity fields:** name, email, phone, date of birth, and a crypto wallet address. Matching uses a normalized email, phone or wallet address, chosen in the UI.

**What each stage reveals, and to whom**

| Stage                      | Querier learns                                           | Banlist holder learns            | What breaks it                                                                  |
| -------------------------- | -------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| 0. Plaintext               | The full banlists                                        | The full customer list           | Nothing to break: everything is shared                                          |
| 1. Hashing                 | The full banlists, after a dictionary attack             | The full customer list, same way | Dictionary attack on low-entropy identifiers                                    |
| 2. Two-party PSI           | Which of its customers are flagged                       | Only the customer list's size    | Fishing: the querier screens made-up or scraped identities to probe the banlist |
| 3. Multi-party PSI         | Which customers are flagged, and by which institution    | Only the list size               | Attribution leak, plus fishing across every list at once                        |
| 4. DP risk score + budgets | A noisy count of institutions that flagged each customer | Nothing new                      | Hard to break within the budget; collusion with the coordinator is out of scope |

One honest limit: the querier learning that _its own_ customer is flagged is the point of the product, not a leak. What stages 2–4 protect is everyone _not_ in the overlap, which institution flagged whom, and how much the querier can probe. DP alone does not stop fishing for one identity, so stage 4 pairs it with a per-querier query budget.

## Phase map

After P0 and P1, five tracks run in parallel. P1 now also defines the protocol contract: the `Protocol` interface and an in-memory channel. With that in place, every algorithm can be built and tested without workers or UI.

Each stage phase (P4–P7) splits into two halves:

- **Core:** pure TypeScript protocol and attack code, plus its Vitest tests (unit, property, protocol, attack). It runs in wave 2.
- **Page:** wiring into workers and the UI, the explainer, and the Playwright test. It runs in wave 3, once the runtime and UI shell exist.

_Diagram (not exported): wave 1 runs P0 then P1 in order; wave 2 runs five tracks in parallel (P2 worker runtime, P3 UI shell, P4 hashing core, P5–P6 PSI core, P7 DP primitives); wave 3 integrates the stage pages and the stage 4 coordinator; wave 4 ships P8, P9 and P10._

The PSI track is the longest, because multi-party PSI builds on two-party PSI and the stage 4 protocol needs both PSI and the DP primitives. Starting it first shortens the whole schedule.

| Track (wave 2) | Phases                    | Needs                           | Folders it owns                                             |
| -------------- | ------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Worker runtime | P2                        | P1 contract                     | `src/runtime/`                                              |
| UI shell       | P3                        | P1 types, recorded fixture runs | `src/ui/`                                                   |
| Hashing core   | P4 core                   | P1 contract                     | `src/protocols/hashing/`, `src/attacks/dictionary/`         |
| PSI core       | P5 core, then P6 core     | P1 contract                     | `src/crypto/`, `src/protocols/psi/`, `src/attacks/fishing/` |
| DP primitives  | P7 core: noise and ledger | Nothing beyond P0               | `src/dp/`                                                   |

Tracks own separate folders, so parallel sessions don't conflict. Shared files (the stage registry, `package.json`) change only in P0–P1 or during wave 3 integration.

## Testing strategy

A phase is done when its new tests pass, every earlier test still passes, and its demo check works on the deployed GitHub Pages URL. Correctness and privacy claims are tested first; speed is not tested until P9.

| Layer      | Tool                             | Runs in                                             | Purpose                                                                              |
| ---------- | -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit       | Vitest                           | Node, every push                                    | Pure functions: generator, normalizer, crypto wrappers, noise, ledger                |
| Property   | fast-check in Vitest             | Node, every push                                    | Invariants over random inputs, for example "PSI output equals the true intersection" |
| Protocol   | Vitest with an in-memory channel | Node, every push                                    | Whole protocols without workers, so logic is tested apart from transport             |
| Attack     | Vitest                           | Node, every push                                    | Each attack must succeed on the stage it breaks and fail on the stage that fixes it  |
| Component  | React Testing Library            | jsdom, every push                                   | Panels and explainers render correctly from fixture runs                             |
| End to end | Playwright (Chromium)            | Preview build in CI, then the live URL after deploy | Real workers, real UI, one run per stage                                             |

**Rules that apply to every phase**

- **Seeded randomness in tests only.** Generators and noise take an injected RNG. Shipped code uses `crypto.getRandomValues`, and a test asserts the injection point is not reachable from the production bundle.
- **Ground truth from the generator.** Every protocol test compares against the generator's known overlap, never against another protocol's output.
- **Statistical tests use fixed seeds and wide bounds.** They state the bound they check, so a failure means a real bug, not bad luck.
- **Test names are the claim.** For example `psi.attack.dictionary.recovers_nothing`, so the test list reads as the demo's claims.
- **CI gate:** typecheck, lint, all Vitest suites and Playwright against the preview build must pass before the Pages deploy job runs.

## P0 — Scaffold and deploy

P0 gets an empty React app building, testing and deploying to GitHub Pages, so every later phase ships to a live URL.

**Deliverables**

- Vite + React + TypeScript (strict), ESLint and Prettier.
- Hash-based routing (`/#/stage/hashing`), because GitHub Pages has no server-side rewrites.
- Vitest, React Testing Library, fast-check and Playwright configured.
- GitHub Actions: CI job (typecheck, lint, tests, Playwright on the preview build), then a deploy job to Pages on `main`.
- A placeholder page per stage (0–4) with a title.

**Tests added**

| File                 | Test                        | Checks                                                              |
| -------------------- | --------------------------- | ------------------------------------------------------------------- |
| `app.test.tsx`       | `renders_stage_nav`         | Navigation lists all five stages                                    |
| `e2e/smoke.spec.ts`  | `loads_every_stage_route`   | Each route renders without console errors                           |
| `e2e/smoke.spec.ts`  | `deep_link_survives_reload` | Reloading `/#/stage/psi` stays on that page                         |
| `e2e/worker.spec.ts` | `module_worker_round_trip`  | A module worker loads from the Pages base path and echoes a message |

**Demo check:** the live URL loads, and every stage tab opens.

## P1 — Synthetic institutions, customers and banlists

P1 builds a seeded generator that produces institutions, customers and banlists with a known, configurable overlap. It also defines the protocol contract (the `Protocol` interface and an in-memory channel, moved here from P2), so all wave 2 tracks can start. It is pure TypeScript with no UI, so it is fully unit-tested before anything depends on it.

**Deliverables**

- **Identity generator.** Fictional names from bundled lists, emails, phones (E.164), dates of birth, and wallet addresses (random 20-byte hex in Ethereum format). No real people's data.
- **Formatting noise.** Mixed case, whitespace, Gmail dots and `+tags`, phone formats with spaces or dashes, wallet addresses with and without checksum casing.
- **Normalizer.** Turns each field into one canonical form, so the same person matches across institutions.
- **Scenario builder.** It takes a config (institution names, customer count, banlist sizes, overlap rates, reason mix) and returns each party's private data plus a separate ground-truth object.
- **Three presets:**
  - _Onboarding check:_ a new exchange screens 1 applicant against 1 broker's banlist.
  - _Portfolio sweep:_ a broker screens 10,000 customers against 1 exchange's banlist of 2,000.
  - _Consortium screen:_ an exchange screens 10,000 customers against 4 institutions' banlists, with people flagged by 0–4 of them.

**Tests added**

| File                | Test                                         | Checks                                                                                       |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `generator.test.ts` | `same_seed_same_output`                      | Identical output for the same seed and config                                                |
| `generator.test.ts` | `overlap_matches_config`                     | Realized overlap within ±0.5 percentage points of the config (property test over configs)    |
| `generator.test.ts` | `ground_truth_is_consistent`                 | Ground truth equals the intersection computed from raw lists after normalization             |
| `generator.test.ts` | `multi_list_counts`                          | In the consortium preset, the distribution of "flagged by k institutions" matches the config |
| `normalize.test.ts` | `email_cases`, `phone_cases`, `wallet_cases` | Table of noisy inputs to expected canonical outputs                                          |
| `normalize.test.ts` | `idempotent`                                 | Normalizing twice equals normalizing once (property test)                                    |
| `presets.test.ts`   | `presets_build`                              | All three presets build and match their documented sizes                                     |

**Demo check:** a debug page shows a preset's institutions and ground truth in tables (hidden from the main navigation).

## P2 — Party runtime, channel and plaintext baseline

P2 builds the transport every stage runs on: one Web Worker per institution, a main-thread channel that logs every message, and a protocol interface. It proves the transport with stage 0, which simply sends the lists in plain text.

**Deliverables**

- **Protocol interface.** `Protocol { id, roles, run(role, ctx) }`, where `ctx` gives `send`, `receive`, `rng` and `progress`. The same protocol code runs in workers or on an in-memory channel in tests.
- **Party worker.** Receives its private data once at setup and never posts raw data back, except through an explicit god-view request that the UI labels.
- **Channel.** Relays typed messages `{ from, to, type, round, payload }` and appends each to a wire log with byte size and a payload preview. Large arrays move as transferable `ArrayBuffer`s.
- **Run controller.** Starts a run, streams progress, collects results, and cancels cleanly.
- **Stage 0 protocol:** each banlist holder sends its list; the querier intersects.

**Tests added**

| File                 | Test                         | Checks                                                                             |
| -------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `channel.test.ts`    | `logs_every_message`         | Each send appears once in the wire log with correct sender, receiver and byte size |
| `channel.test.ts`    | `preserves_order_per_link`   | Messages between two parties arrive in send order                                  |
| `plaintext.test.ts`  | `result_equals_ground_truth` | Stage 0 result equals ground truth for all presets                                 |
| `plaintext.test.ts`  | `wire_contains_raw_lists`    | The wire log contains the banlist values, which is the baseline leak               |
| `runner.test.ts`     | `cancel_stops_run`           | Cancelling ends the run with no further messages                                   |
| `e2e/stage0.spec.ts` | `plaintext_run_in_workers`   | Real workers produce the same result as the in-memory run                          |

**Demo check:** on the stage 0 page, run the portfolio sweep and see the result and the raw lists in the wire log.

## P3 — React UI shell and stage explainers

P3 builds the layout every stage page shares, including a short explainer at the top of each page. After P3, adding a stage means adding a protocol, an attack and an explainer entry, with no layout work.

**Page layout, top to bottom**

1. **Stage explainer** (collapsible, open on first visit), in three parts:
   - _How it works:_ 3–5 numbered steps, each tied to a button or panel on the page ("Step 2: press Run; watch blinded points cross the wire").
   - _What it protects:_ one line.
   - _What breaks it:_ the attack's name, one line on how it works, and a **Run attack** button. Stage 4 says what remains out of scope instead.
2. **Scenario bar:** preset picker, match field (email, phone or wallet), seed, Run.
3. **Party cards:** one per institution, with list size and a locked icon. Raw rows appear only when god view is on.
4. **Wire inspector:** a scrolling message log, with a payload preview and an "Eavesdropper sees" line for each message.
5. **Results and attacker panel side by side:** what the querier learned, and what the attack recovered, both checked against ground truth.

Explainer copy lives in one typed file per stage (`stages/<id>/explainer.ts`), so the text is reviewed in one place and tested for completeness.

**Tests added**

| File                     | Test                               | Checks                                                                                              |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Explainer.test.tsx`     | `renders_steps_protects_breaks`    | All three parts render for every stage                                                              |
| `explainers.test.ts`     | `every_stage_has_explainer`        | Each registered stage has steps (3–5), a protects line and either an attack or an out-of-scope note |
| `explainers.test.ts`     | `steps_reference_real_controls`    | Every control a step names exists on that page (by test ID)                                         |
| `WireInspector.test.tsx` | `renders_fixture_log`              | Renders a recorded log with sizes and previews                                                      |
| `PartyCard.test.tsx`     | `hides_rows_without_god_view`      | Raw rows render only with god view on                                                               |
| `e2e/layout.spec.ts`     | `explainer_collapses_and_persists` | Collapse state survives a reload                                                                    |

**Demo check:** stage 0 runs through the full layout, and its explainer reads "What breaks it: nothing needed, everything is visible."

## P4 — Stage 1: hash matching and the dictionary attack

P4 ships the approach many consortiums actually use, hashing identifiers before sharing, and shows that a banlist of hashed emails or phones can be reversed.

**Protocol:** each party sends `SHA-256(normalized id)`. A toggle switches to a keyed hash (HMAC with a key all members share).

**Attack, "Dictionary reversal":** the attacker hashes candidate identifiers (name-based emails on common domains, phone ranges, and every wallet address seen on a public chain, simulated by a bundled list) and looks them up in the received hashes. With HMAC on, an outsider without the key recovers nothing, but a member with the key recovers just as much.

**Explainer**

- _How it works:_ normalize, hash, send hashes, intersect.
- _What it protects:_ nothing against a member; HMAC only stops outsiders.
- _What breaks it:_ dictionary reversal, because emails and phones are guessable.

**Tests added**

| File                     | Test                               | Checks                                                                         |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------ |
| `hashing.test.ts`        | `result_equals_ground_truth`       | Hash intersection equals ground truth for every preset and match field         |
| `hashing.test.ts`        | `wire_has_no_plaintext`            | No raw identifier appears in the wire log                                      |
| `hashing.attack.test.ts` | `dictionary.recovers_most_banlist` | At least 80% of banlist emails are recovered in the portfolio preset           |
| `hashing.attack.test.ts` | `hmac.outsider_recovers_nothing`   | With HMAC on, an attacker without the key recovers 0                           |
| `hashing.attack.test.ts` | `hmac.member_recovers_most`        | A member with the key still recovers at least 80%                              |
| `e2e/stage1.spec.ts`     | `run_then_attack`                  | Run, then Run attack; the panel shows recovered identities that match god view |

**Demo check:** the attacker panel shows most of the broker's 2,000 banned identities recovered, including people who were never the querier's customers.

## P5 — Stage 2: two-party PSI and the fishing attack

P5 replaces hashes with Diffie–Hellman PSI on Ristretto255. The querier learns which of its own customers are on the banlist, and nothing about anyone else on it. The banlist holder learns only how many customers were screened.

**Protocol**

1. The querier blinds each customer as `H(x)^q` with a secret scalar `q` and sends them in shuffled order.
2. The banlist holder raises them to its secret `k`, returns them in the same order, and also sends its own entries as `H(b)^k`.
3. The querier raises the holder's points to `q` and compares. Blinding commutes, so `(H(x)^q)^k = (H(b)^k)^q` exactly when `x = b`.

**Attacks**

- **Dictionary reversal (replayed):** recovers nothing, because the wire carries points blinded with scalars the attacker does not have.
- **Fishing:** the querier pads its "customers" with 50,000 candidate identities from the dictionary. PSI correctly reports every candidate on the banlist, so the querier scrapes most of the list. This is the attack stage 4 limits.

**Explainer**

- _How it works:_ the three protocol steps above, each tied to a highlighted wire message.
- _What it protects:_ banlist entries outside your customer base; your customer list.
- _What breaks it:_ fishing with made-up customers. Also, list sizes are visible.

**Tests added**

| File                 | Test                          | Checks                                                                                  |
| -------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `ristretto.test.ts`  | `blinding_commutes`           | `(P^a)^b = (P^b)^a` for random points and scalars (property test)                       |
| `ristretto.test.ts`  | `hash_to_curve_vectors`       | Matches the published RFC 9380/9496 test vectors                                        |
| `psi.test.ts`        | `result_equals_ground_truth`  | Querier output equals ground truth across seeds, sizes and match fields (property test) |
| `psi.test.ts`        | `holder_learns_only_size`     | The holder's received messages contain only blinded points and their count              |
| `psi.test.ts`        | `fresh_scalars_per_run`       | Two runs on the same data produce unrelated wire bytes                                  |
| `psi.attack.test.ts` | `dictionary.recovers_nothing` | The P4 attack on the PSI wire recovers 0                                                |
| `psi.attack.test.ts` | `fishing.scrapes_banlist`     | Padding with the dictionary recovers at least 80% of the banlist                        |
| `e2e/stage2.spec.ts` | `run_then_both_attacks`       | Dictionary attack shows 0 recovered; fishing shows the banlist recovered                |

**Demo check:** the same scenario as stage 1, where the dictionary attack now finds nothing, then fishing scrapes the list anyway.

## P6 — Stage 3: multi-party PSI and the attribution leak

P6 runs the P5 protocol between the querier and each of up to 4 banlist holders in parallel. The querier gets a per-customer view: which institutions flagged each customer. This is the most useful output, and also the leakiest.

**Deliverables**

- Parallel PSI sessions, one per holder, each with fresh scalars.
- A results grid: customers down the side, institutions across the top, flagged cells marked.
- A per-customer risk count (flagged by k of N).

**What leaks**

- **Attribution:** the querier learns _which_ institution flagged a customer. A holder may not want that known, because a flag can carry legal and reputational risk, and it reveals the holder's detection coverage.
- **Fishing at scale:** one padded run now scrapes every banlist at once.

**Explainer**

- _How it works:_ stage 2, run once per institution; results are combined per customer.
- _What it protects:_ everyone outside your customer base, at every institution.
- _What breaks it:_ attribution is revealed by design; fishing works on every list at once.

**Tests added**

| File                      | Test                                 | Checks                                                                                                 |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `multipsi.test.ts`        | `grid_equals_ground_truth`           | Each customer × institution cell equals ground truth, for 1–4 holders (property test)                  |
| `multipsi.test.ts`        | `parallel_equals_sequential`         | Running sessions in parallel or one at a time gives the same grid                                      |
| `multipsi.test.ts`        | `sessions_use_independent_scalars`   | No scalar is reused across holders                                                                     |
| `multipsi.attack.test.ts` | `attribution.querier_learns_flagger` | Documents the leak: for flagged customers the querier names the institution correctly 100% of the time |
| `multipsi.attack.test.ts` | `fishing.scrapes_all_lists`          | Padding recovers at least 80% of each banlist                                                          |
| `e2e/stage3.spec.ts`      | `consortium_grid_matches_god_view`   | Grid matches god view for the consortium preset                                                        |

**Demo check:** the consortium preset shows a customer flagged by 3 of 4 institutions, with names. The explainer asks: should you be able to see who flagged them?

## P7 — Stage 4: DP risk scores and query budgets

P7 stops the querier from learning who flagged a customer, and caps how much it can probe. The querier receives only a noisy count of institutions that flagged each customer, shown as a risk tier. Every score spends privacy budget.

**Protocol**

1. As in stage 3, each holder double-blinds the querier's points in order, but sends them to the coordinator instead of back to the querier. It sends its own banlist, blinded once, to the querier.
2. The querier applies its scalar to each holder's banlist points. It forwards them to the coordinator. The querier never holds both doubly-blinded sets, so it cannot compare them itself.
3. For each customer position, the coordinator counts how many holders matched and adds discrete Laplace noise with scale 1/ε. It sees only blinded points and positions, never identities.
4. The querier receives one noisy count per customer, mapped to a tier (Clear, Review, High risk), and the ledger records the spend.

**Budget ledger.** Each score costs ε (default 0.5). A querier has a budget per period (for example, ε = 500 a day, enough for 1,000 screenings). Each customer also has a lifetime cap, so re-screening the same person to average out the noise is refused. Both limits are shown as bars.

**Attacks replayed**

- **Attribution:** the querier receives no per-institution output, so its guess at the flagger is no better than chance.
- **Averaging:** repeated screens of one customer stop at the per-customer cap; the panel shows the estimate stalling.
- **Fishing:** a 50,000-identity padded run exceeds the period budget and is refused. A run within budget yields only noisy scores for that many identities.
- **Single-query membership test:** no attack can tell "flagged by one more institution" from "not" more than e^ε/(1+e^ε) of the time (about 62% at ε = 0.5). The panel plots measured accuracy against this bound.

**Explainer**

- _How it works:_ the four steps above, with an ε slider and a live chart of tier accuracy against ε.
- _What it protects:_ who flagged whom, and the banlists from bulk probing.
- _What's out of scope:_ a coordinator that colludes with a party; malicious parties that deviate from the protocol.

**Tests added**

| File                    | Test                                                     | Checks                                                                           |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `noise.test.ts`         | `discrete_laplace_moments`                               | Mean and variance over 10^5 seeded draws match the formulas within stated bounds |
| `noise.test.ts`         | `integer_only`                                           | Samples are integers; no floating-point sampling path exists                     |
| `ledger.test.ts`        | `never_negative`, `refuses_overspend`                    | Property tests over random query sequences                                       |
| `ledger.test.ts`        | `per_customer_cap`                                       | The (cap/ε + 1)th screen of one customer is refused                              |
| `dprisk.test.ts`        | `noiseless_equals_ground_truth`                          | With noise disabled (test only), counts equal ground truth                       |
| `dprisk.test.ts`        | `coordinator_sees_no_identities`                         | The coordinator's inputs contain only blinded points and position indices        |
| `dprisk.attack.test.ts` | `attribution.at_chance`                                  | Flagger-guess accuracy is within sampling error of 1/N                           |
| `dprisk.attack.test.ts` | `membership.under_bound`                                 | Measured accuracy is at most e^ε/(1+e^ε) plus sampling error                     |
| `dprisk.attack.test.ts` | `fishing.refused_over_budget`, `averaging.stalls_at_cap` | Both attacks are stopped by the ledger                                           |
| `e2e/stage4.spec.ts`    | `tiers_render_and_budget_drains`                         | Running the consortium preset shows tiers and drains the budget bar              |

**Demo check:** stage 3's "flagged by 3 of 4, with names" becomes "High risk", with no institution named. Fishing and averaging are both refused.

## P8 — Demo polish and guided walkthrough

P8 makes the five stages read as one story for a reviewer who has never heard of PSI. No new protocols are added.

**Deliverables**

- A landing page with the use case in two sentences and a "Start the walkthrough" button.
- A guided mode that carries the same scenario and seed from stage 0 to 4, ending each stage on its attack and pointing to the next.
- A summary page: the "what each stage reveals" table, filled in from the reviewer's own runs.
- Empty, loading and error states; keyboard navigation and labels on all controls.
- An explainer copy pass, keeping each part to one or two short lines.

**Tests added**

| File                      | Test                           | Checks                                                                                              |
| ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `e2e/walkthrough.spec.ts` | `full_walkthrough`             | A reviewer path from landing through stage 4 completes, with each attack giving its expected result |
| `e2e/a11y.spec.ts`        | `no_serious_violations`        | axe-core finds no serious or critical issues on any page                                            |
| `e2e/errors.spec.ts`      | `worker_failure_shows_message` | A forced worker error shows a readable message, not a blank page                                    |

**Demo check:** a 5-minute screen recording of the walkthrough, with no narration gaps where the UI is unclear.

## P9 — Benchmarks and scale

P9 comes after the demo is correct and complete. It adds a `/bench` page that measures the cost of privacy on the reviewer's own machine. The size tiers in the spec are estimates until this phase measures them.

**Deliverables**

- Size tiers (1k, 10k, 100k per party) offered in the scenario bar, with progress and cancel for long runs.
- A worker pool inside each party for curve operations.
- A `/bench` page that charts time against set size (hashing against PSI), speedup against worker count, and bytes on the wire per stage.
- Stretch goal: WASM `libsodium` Ristretto compared with pure JS.

**Tests added**

| File               | Test                         | Checks                                                                                |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| `pool.test.ts`     | `pooled_equals_single`       | Pooled PSI output equals single-worker output                                         |
| `bench.test.ts`    | `harness_reports_all_series` | The harness produces every series with no missing points                              |
| `e2e/perf.spec.ts` | `medium_tier_under_ceiling`  | The 10k tier finishes under a generous ceiling in CI, to catch large regressions only |

**Demo check:** the reviewer runs `/bench` and sees PSI cost hundreds of times more compute than hashing, at the same bytes on the wire.

## P10 — Submission package

P10 produces the three take-home deliverables and the session transcripts.

- [ ] Deployed GitHub Pages URL, linked at the top of the README
- [ ] GitHub repo with a README: what it is, how to use it, architecture, how to run the tests
- [ ] Written design rationale: why Theme 1, why this use case, key decisions and tradeoffs, extensions, time spent
- [ ] A recorded video of about 5 minutes following the P8 walkthrough
- [ ] Transcripts exported with `export-transcripts.sh` (add `--repo` once the repo exists), reviewed before committing
- [ ] Backlog (you): finish the stage 1 preimage search on branch `wave2-hashing-preimage`. `preimageSearch.ts` and `phoneRangeCandidates` are done; `preimageSearch.test.ts` is partial and does not compile. Then merge it and wire it into the stage 1 page.

**Tests added:** `e2e/live.spec.ts`, which runs the full walkthrough against the live URL as a final check.
