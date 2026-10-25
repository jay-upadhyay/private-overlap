# Private Overlap — Spec

Oct 24, 2026 · @Jay

> Exported from the project's planning documents on 2026-10-24. The status section is final; the sections after it are the original plan, kept as written, so they still say what was intended at the time.

Decided: Theme 1, React, and one use case (exchanges and brokers screening customers against other institutions' banlists). Build order, per-phase tests and the updated stage design live in [the phase document](phases.md), which wins where the two docs differ.

## Final status

As of Oct 24, 2026 the prototype is live at [jay-upadhyay.github.io/private-overlap](https://jay-upadhyay.github.io/private-overlap/) (code: [github.com/jay-upadhyay/private-overlap](https://github.com/jay-upadhyay/private-overlap)). Where the build differs from this spec:

- **Use case narrowed** to institutions screening customers against other institutions' banlists, with five stages: plaintext, hashing, two-party PSI, multi-party PSI, DP risk scores.
- **Stage 2's leak is fishing** (a querier padding its list), not a differencing attack on PSI-CA; PSI-CA itself was not built.
- **Stage 4 uses a coordinator** that sees only doubly blinded points and releases noisy counts per customer, with a page-level privacy budget.
- **Added beyond the spec:** theory pages with live worked examples and checked references, plain-language explanations of every run, a like-for-like summary, custom sizes with run-time estimates, and an ε slider with a tier-accuracy chart.
- **Deferred:** benchmarks and the scale tiers (M2's 100k and 1M sizes); full-size PSI runs take about 25 s.

The phase document tracks per-phase status; the repo's DESIGN.md is the written rationale.

## Theme recommendation

Submit under **Theme 1, Exploration & Understanding**, and keep the systems work as a strength rather than the headline. The demo is an explainer: each stage shows why the previous technique fails, so the reviewer builds intuition for PSI and DP by watching attacks succeed and then fail.

| Theme                          | Fit     | What graders would expect                                                                                             |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| 1. Exploration & Understanding | Strong  | An unfamiliar concept made intuitive through interaction. The hash → PSI → DP progression is exactly that.            |
| 3. Systems & Reliability       | Partial | Failure handling, concurrency and graceful degradation. The plan has workers and scale but no real failure model yet. |
| 4. Evaluation & Data Quality   | Weak    | Evals, reward models, data pipelines. Record linkage is related but not the point here.                               |

If you prefer Theme 3, add one milestone: a party drops out mid-protocol, messages are lost or reordered, and the budget ledger must stay consistent across retries. That is about 1 extra day and makes the systems claim honest.

## Overview

A browser app where a crypto exchange or broker screens its customers against banlists held by up to 4 other institutions, without either side revealing its own data. Each institution runs in its own Web Worker and talks only through a visible message channel.

The story has three acts. Each act ends with an attack that breaks it, which motivates the next one.

1. **Hash matching.** Parties exchange SHA-256 hashes of emails. Attack: a dictionary attack reverses most hashes in seconds, because identifiers have low entropy.
2. **Private set intersection (PSI).** Parties exchange blinded elliptic-curve points. The dictionary attack now finds nothing. A cardinality-only mode (PSI-CA) reveals just the count. Attack: a differencing query (overlap with S, then with S plus one target) still reveals whether one person is in the other set.
3. **Differential privacy (DP) on top.** Released counts get calibrated noise, and every party has a privacy budget (ε) that queries spend. The differencing attack now returns noise, and averaging repeated queries is stopped once the budget runs out.

**First 30 seconds for a reviewer:** pick the "Portfolio sweep" scenario and press Run. Watch messages cross the wire inspector, see the overlap appear, then press "Attack" and watch the hashes get cracked. The stage switcher then moves them to PSI and DP with the same data.

Three features carry the demo:

- **Wire inspector.** It shows every message between parties: its size, a sample of its payload, and what an eavesdropper could learn from it.
- **Attacker panel.** It runs the attack for the current stage and reports the result, for example "9,412 of 10,000 emails recovered in 1.8 s".
- **God view toggle.** It shows the ground truth, so the reviewer can check that results are correct.

## Architecture

The app is a static site with no backend. Every party, the coordinator and the attacker run as Web Workers in the reviewer's browser. The main thread only relays and logs messages.

_Diagram (not exported): parties A to N, each in its own Web Worker, connect only to a channel relay on the main thread, which feeds a wire log; a coordinator worker (stage 4) and an attacker worker sit beside it, and the attacker reads only the wire log._

A party's raw data exists only inside its own worker. Everything else sees only what crossed the channel, which is exactly what the wire inspector shows.

| Piece     | Choice                              | Why                                                                                   |
| --------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| Build     | Vite + TypeScript                   | Native module-worker bundling, fast dev loop                                          |
| UI        | React                               | Familiar to the author                                                                |
| Curve     | `@noble/curves` Ristretto255        | Audited pure JS, prime-order group, hash-to-curve built in                            |
| Hashing   | `@noble/hashes` SHA-256             | Synchronous, so it runs in tight loops; WebCrypto `digest` is one async call per item |
| Messaging | Typed `postMessage`, no RPC library | Keeps each message boundary visible to the wire log                                   |
| Charts    | Observable Plot                     | Small, good defaults for benchmark and ε charts                                       |
| Deploy    | GitHub Actions to Pages             | Push to `main` publishes; Playwright runs against the live URL                        |

Messages have the shape `{ from, to, type, round, payload }`, where `payload` is JSON or a transferable `ArrayBuffer`. Byte size is recorded at send time.

## M0 — Shared foundations

M0 builds everything the three protocols share, so M1–M3 only add a protocol module, an attack and a panel. It ends with a deployed page that runs a trivial "send plaintext" protocol end to end.

**Deliverables**

- **Repo and deploy.** Vite + TypeScript, Vitest, Playwright, and a GitHub Actions workflow that publishes to GitHub Pages on push to `main`.
- **Data generator (seeded).** It generates synthetic identities (name, email, phone, national-ID-like number) from a seed. Overlap is configurable per party and per subset, for example A∩B = 12%, A∩B∩C = 3%. It adds realistic formatting noise (case, whitespace, `+tag` and dots in Gmail addresses, phone formats). Ground truth is returned separately for the god view.
- **Normalizer.** It turns noisy identifiers into canonical form (`John.Doe+x@Gmail.com` → `johndoe@gmail.com`). Every protocol hashes the normalized value, so matching quality is the same across stages.
- **Scenarios.** Three bundled presets: _Banks sharing a fraud banlist_ (2 parties), _Retailer × ad platform audience overlap_ (2 parties, unequal sizes), _Five hospitals deduplicating patients_ (5 parties).
- **Party runtime.** One Worker per party. It holds that party's data, which never leaves the worker in clear text. A worker pool inside each party spreads heavy work across `navigator.hardwareConcurrency` cores.
- **Channel and wire log.** The main thread relays typed messages between parties. Every message is logged with sender, receiver, type, byte size and a payload preview. Large arrays move as transferable `ArrayBuffer`s to avoid copying.
- **Protocol interface.** `Protocol { id, roles, run(ctx) }`, where `ctx` gives `send`, `receive`, `progress` and `metrics`. A protocol is a state machine per role, so the UI can step through it.
- **UI shell.** Scenario picker, party cards, stage switcher, wire inspector, attacker panel, results panel, god-view toggle and a metrics strip (time, bytes on wire, operations).
- **Metrics.** A timer per phase, byte counter per link, and an export of a run as JSON for the benchmark page.

**Demo moment:** pick a scenario, press Run with the plaintext protocol, and see the overlap and the full lists on the wire. This is the "no privacy" baseline.

**Exit tests:** generator is deterministic per seed and hits the requested overlaps within ±0.5%; normalizer has a table of edge cases; plaintext protocol result equals ground truth; Playwright smoke test passes on the deployed URL.

## M1 — Hash matching and why it fails

M1 ships the approach most teams try first and shows it reveals almost everything. Both parties send `SHA-256(normalized id)` and intersect the hash sets.

**Variants on one toggle**

- **Plain hash.** Anyone who sees the wire can reverse it.
- **Keyed hash (HMAC with a shared secret).** Outsiders can no longer reverse it, but the partner holds the key and can still run the same attack. This shows that the problem is the partner, not the network.

**Attack: dictionary reversal.** The attacker worker builds candidates from the generator's name and domain lists plus phone-number ranges, hashes them, and looks them up in the received hash set. The panel shows the share recovered over time and lists sample cracked emails. The candidate space for phones (about 10^10 for one country) is small enough to sweep with fast hashing in principle; the demo sweeps a scaled-down range and extrapolates the full time.

**Demo moment:** "Partner learned 94% of your non-overlapping customers." The overlap result was correct, but the partner also learned who is _not_ in it.

**Exit tests:** hash intersection equals ground truth; dictionary attack recovers more than 80% of generated emails at the 10k preset; HMAC variant defeats an attacker without the key and is defeated by one with it.

## M2 — Private set intersection

M2 replaces hashes with Diffie–Hellman PSI on the Ristretto255 curve: values are blinded with secret scalars, and blinding commutes, so `(H(x)^a)^b = (H(x)^b)^a`. Without the scalars, the wire carries random-looking points that dictionary attacks cannot reverse. It ships in three steps.

**M2a — Two-party PSI.** The protocol:

1. A picks a secret `a`, sends `H(x)^a` for each of its items, in shuffled order.
2. B picks a secret `b`, sends back `(H(x)^a)^b` in A's order, plus `H(y)^b` for its own items.
3. A raises B's points to `a` and compares. A learns which of its items are shared; B learns only A's set size.

**M2b — PSI-cardinality (PSI-CA).** Same as M2a, but B shuffles the double-blinded list before returning it. A can count matches but cannot tell which items matched.

**M2c — N parties.** Each party's blinded set passes around a ring, and every party applies its scalar. A coordinator worker compares the fully blinded sets and releases a pairwise overlap matrix (shown as a heatmap) plus the all-party count. The coordinator sees only blinded points and counts.

**Attacks shown**

- **Dictionary attack again:** 0 recovered, the M1 attack replayed on the new wire.
- **Differencing attack on PSI-CA:** the attacker runs the count with set S, then S plus one target email. If the count rises by 1, the target is in the other party's set. The panel shows this reveals membership with 100% accuracy for any chosen target.

**Implementation notes:** `@noble/curves` for Ristretto255 and hash-to-curve (RFC 9380/9496); WebCrypto has no raw scalar multiplication. Scalars come from `crypto.getRandomValues`. Threat model is semi-honest: parties follow the protocol but try to learn more from what they see. Set sizes are revealed.

**Exit tests:** commutativity property test over random points; PSI output equals ground truth across seeds and sizes; PSI-CA output equals the true count and its returned order is uncorrelated with input order; N-party matrix equals the ground-truth pairwise matrix; dictionary attack on the PSI wire recovers 0.

## M3 — Differential privacy and privacy budgets

M3 makes every released count differentially private and gives each party a budget that queries spend. It closes the differencing and averaging attacks from M2.

**Where the noise is added.** In two-party PSI-CA the party doing the comparison sees the exact count, so noise added afterward protects nothing from it. M3 therefore runs all comparisons in the coordinator ("clean room") worker, which releases only noisy counts. The assumption that the coordinator does not collude with any party is stated in the UI.

**Mechanism.** Discrete Laplace (two-sided geometric) noise with scale 1/ε on each count. Adding or removing one person changes a count by at most 1, so sensitivity is 1. Integer noise from `crypto.getRandomValues` avoids the floating-point flaws of textbook Laplace sampling.

**Budget ledger.** Each party sets a total ε (default 1.0) and a per-query ε (default 0.1). Under basic composition, each released count spends its ε from every party whose data it touches. The ledger refuses a query that would overspend and shows remaining budget per party as a bar. A pairwise matrix with N(N−1)/2 cells spends ε per cell, which shows why multi-party releases drain budgets fast.

**Attacks replayed**

- **Differencing attack:** accuracy drops toward a coin flip. For a single ε-DP query, no attack can guess membership correctly more than e^ε/(1+e^ε) of the time, which is about 52.5% at ε = 0.1 and 73% at ε = 1. The panel plots measured accuracy against this bound.
- **Averaging attack:** repeating the query and averaging shrinks the noise, until the ledger refuses further queries. The panel shows the attacker's estimate stalling where the budget runs out.

**Controls:** an ε slider with a live chart of relative error versus ε at the current overlap size. It shows the tradeoff: small overlaps need more budget to stay useful.

**Exit tests:** noise sample mean and variance match the discrete Laplace formulas within tolerance over 10^5 draws (seeded test RNG); ledger property tests (never negative, refuses overspend, composes per party); measured differencing-attack accuracy stays under the e^ε/(1+e^ε) bound plus sampling error; averaging attack stops at the budget limit.

## Scale plan

Privacy costs CPU, not bandwidth: a hash and a Ristretto point are both 32 bytes, but a point costs hundreds of times more compute. Benchmarks are built late, in P9, after the demo is correct. Times below are estimates to confirm in P9, assuming about 5,000 curve operations per second per core in pure JS and an 8-core laptop.

| Tier | Items per party  | Hash (M1)     | PSI, 2 parties (M2)          | Where it runs       |
| ---- | ---------------- | ------------- | ---------------------------- | ------------------- |
| S    | 1,000            | instant       | under 1 s                    | Live demo           |
| M    | 10,000 (default) | instant       | about 1 s                    | Live demo           |
| L    | 100,000          | under 1 s     | about 8 s, with progress bar | Live demo, opt-in   |
| XL   | 1,000,000        | a few seconds | about 75 s                   | Benchmark page only |

PSI needs about 3 curve operations per item per party: one hash-to-curve and two scalar multiplications.

**Benchmark page (`/bench`).** It runs the sweeps on the reviewer's own machine and charts the results:

- Time against set size, hash compared with PSI, on log axes.
- Speedup against worker count, from 1 to `hardwareConcurrency`.
- Pure-JS `@noble/curves` compared with WASM `libsodium` Ristretto, as a stretch goal.
- Bytes on the wire per protocol.

No `SharedArrayBuffer` is needed, because transferable buffers are enough. That avoids the cross-origin isolation headers GitHub Pages cannot set.

Memory stays modest: 1M points take 32 MB per copy. Workers stream in chunks of 10k items, so the UI stays responsive and progress is accurate.

## Testing strategy

Every milestone is done only when its exit tests pass in CI and its Playwright scenario passes against the deployed page. Tests check privacy claims as well as correctness: each attack is a test that must succeed on the stage it breaks and fail on the stage that fixes it.

| Layer       | Tool                             | What it covers                                                                                           |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                           | Generator, normalizer, hashing, curve wrappers, noise sampler, budget ledger                             |
| Property    | fast-check                       | Commutative blinding; protocol output equals ground truth for random sets; ledger never overspends       |
| Protocol    | Vitest with an in-memory channel | Full protocol runs without workers, so logic is tested apart from transport                              |
| Attack      | Vitest                           | Dictionary attack beats M1 and fails on M2; differencing beats PSI-CA and stays under the DP bound in M3 |
| Statistical | Vitest, seeded RNG               | Noise mean and variance; attack accuracy within confidence intervals, so tests are not flaky             |
| End to end  | Playwright                       | Each scenario and stage runs in a real browser with workers, against the Pages URL after deploy          |
| Performance | `/bench` + CI smoke test         | The M tier finishes under a time ceiling, to catch large regressions                                     |

Test-only code can inject a seeded RNG. Production code always uses `crypto.getRandomValues`, and a test checks that the injection point is unreachable from the shipped bundle.

## Risks, tradeoffs and open questions

| Risk or tradeoff                                 | Impact                                   | Mitigation                                                                   |
| ------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| Pure-JS curve operations slower than estimated   | L tier too slow to demo live             | Measure in M0 spike; lower tier sizes or add the WASM path                   |
| The coordinator is a trusted party in M2c and M3 | Weaker story than fully distributed DP   | State it in the UI; list distributed noise as an extension                   |
| Semi-honest model only                           | A malicious party could send fake points | State it; out of scope for a prototype                                       |
| Statistical tests are flaky                      | CI noise                                 | Seeded RNG and wide confidence intervals                                     |
| Too much crypto detail for a 5-minute video      | Reviewer loses the thread                | Keep math in collapsible "How it works" drawers; the attacks carry the story |

**Extensions with more time:** distributed noise, where each party adds a share so no one sees the exact count; DP by random padding of input sets; threshold queries ("on at least k of N banlists"); fuzzy matching on names; OPRF-based PSI for unbalanced sets; a dropout and retry layer if you take Theme 3.

**Open questions for you**

- [ ] Theme: Theme 1 (decided).
- [ ] UI framework: React (decided).
- [ ] How much time do you want to spend in total? That sets whether M2c and the WASM benchmark are in scope.
- [ ] Scenarios: exchange and broker banlist screening (decided).
