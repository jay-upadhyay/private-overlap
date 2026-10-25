# Design rationale

> Draft. Edit freely; items in [brackets] need the author's input.

## Theme and idea

**Theme 1, Exploration & Understanding.** Private set intersection and differential privacy are
easy to state and hard to feel. "Hash the emails before sharing" sounds private; most people
cannot say why it is not, or what PSI adds, or why DP still matters after PSI. A static explainer
can state those facts. This prototype lets a reviewer _watch_ them: each stage runs a real
protocol on realistic synthetic data, shows every message on the wire, checks the result against
ground truth, and ends on the weakness that motivates the next stage.

**The use case** is fraud screening between financial institutions: any institution (a bank, a broker, a crypto exchange) checking whether its customers appear on other institutions' banlists. The demo's fictional parties happen to be exchanges, brokers and banks, but nothing in the protocols depends on the kind of institution. Both sides have real
reasons to keep their data private. Customer lists are competitive, and banlists carry legal risk
for whoever shares them. That makes the tradeoffs concrete instead of abstract.

## What is non-obvious

- **Learning that your own customer is flagged is the product, not a leak.** The interesting
  question is what else leaks: banned people who are _not_ your customers (stages 0 and 1), which
  institution flagged whom (stage 3), and how much a querier can probe (stages 2 and 3). The
  stages are organised around those three leaks rather than around algorithms.
- **PSI is exact, and that is a weakness.** It answers whatever the querier asks, so a querier
  can include identities that are not its customers. Cryptography alone cannot tell a real
  customer from a guess; stage 4 answers with a privacy budget, which is a policy control.
- **For most customers, DP accuracy and the attacker's bound are the same number.** For a
  customer nobody flagged, the chance their tier comes out right is exactly e^ε/(1+e^ε), the
  best possible accuracy of an attacker guessing membership from one score. I first drew both as
  curves and they sat on top of each other. The page states this instead: at ε 0.5 about 61% of
  tiers are exact, and a single score lets an attacker guess membership at most 62% of the time.
  Accuracy and exposure rise together.

## Key decisions and tradeoffs

| Decision                                                          | Why                                                                                                                                      | Cost                                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Everything in the browser, one Web Worker per institution         | No backend to deploy or trust; each party's data really is isolated in its own worker, and the main thread only relays and logs messages | Elliptic-curve work is about 1 ms per value in pure JS, so the PSI stages default to 1,000 customers (a few seconds) |
| One `Protocol` interface for every stage                          | The same code runs on an in-memory channel in tests and across workers in the app, so tests exercise the shipped protocol                | A thin abstraction to maintain                                                                                       |
| ristretto255 via `@noble/curves`, hash-to-group per RFC 9380/9496 | A prime-order group avoids cofactor pitfalls; the library is audited and needs no WASM loading                                           | Slower than native or WASM code                                                                                      |
| Exact integer discrete Laplace sampling                           | Floating-point Laplace samplers have known privacy failures (Mironov 2012)                                                               | More code than one line of `Math.random`                                                                             |
| Stage 4 uses a coordinator that sees only blinded points          | Gives noisy counts without the querier ever holding both blinded sets                                                                    | Assumes the coordinator does not collude with a member; stated on the page                                           |
| Semi-honest model throughout                                      | Keeps the protocols readable                                                                                                             | Malicious parties are out of scope, and the page says so                                                             |
| Synthetic, seeded data with ground truth                          | Reviewers need no data, every result can be checked, and runs are reproducible                                                           | Real data is messier than the generator's formatting noise                                                           |
| Correctness and explanation before performance                    | The theme rewards understanding, not speed                                                                                               | A full-size (10,000-customer) two-party PSI run takes about 25 s, and the four-bank consortium longer                |

## How it was built

Phases, each ending deployed with its tests green: a scaffold with CI and Pages deploy; the data
generator and protocol contract; then five tracks in parallel (worker runtime, UI shell, hashing,
PSI, DP primitives) on a shared kit of crypto, data and test helpers so no track duplicated
another; then integration, the ε chart, and the walkthrough, theory pages and summary.

Tests are named as claims and check privacy properties as well as correctness: what each party
receives, that no identifier appears on the PSI wire, that the coordinator sees only points. The
like-for-like summary caught two real bugs: the walkthrough mixed 10,000- and 1,000-customer
runs, and two-party PSI on a multi-bank preset was graded against every bank's list instead of
the one it queried.

## Limitations

- Semi-honest security only; a malicious querier or holder can deviate undetected.
- The stage 4 coordinator must not collude with any member.
- The per-customer budget cap is keyed by the querier's own row ids, so it holds only for an
  honest querier.
- At ε 0.5 per score, only about 60% of tiers are exact: the privacy is real and so is the cost.
- Not built, by choice: a dedicated stage 3 attribution panel (the leak is shown elsewhere on the
  page), attack panels for stage 4, and the benchmark phase. See [FUTURE_WORK.md](FUTURE_WORK.md).

## Extensions with more time

- **Speed:** a worker pool inside each party (an estimated 4–8× on a typical laptop) and a WASM curve library,
  so full-size runs are interactive; a benchmark page measuring both.
- **Unbalanced PSI:** OPRF-based protocols suit one small querier against large banlists.
- **Distributed noise:** each holder adds a share of the noise, removing the trusted coordinator.
- **Malicious security**, and checks that a querier's inputs are real customers (for example,
  signed customer attestations).
- **Threshold queries** ("flagged by at least k of n") and fuzzy matching on names.

## Time spent

About 5 hours of active work in one day (2026-10-24): from 12:25 to 19:30, minus a 2 h 15 min
pause (15:20 to 17:35) while waiting out a usage limit. That includes planning, the spec and phase
documents, and the final review. Commits run from 13:20 to 19:31.
