# Private Overlap

**Live demo: https://jay-upadhyay.github.io/private-overlap/**

A crypto exchange wants to know which of its customers other exchanges, brokers and banks have
banned, but nobody will hand over a customer list or a banlist. This is an interactive explainer
that walks through five ways to compute that overlap, from sending the lists in the clear to
private set intersection (PSI) to differential privacy (DP), and shows what each one leaks and
what breaks it. Everything runs in your browser, with each institution in its own Web Worker.

Design rationale: [DESIGN.md](DESIGN.md).

## Using it

Open the live demo and press **▶ Walkthrough**. It carries one synthetic scenario (an exchange
screening 1,000 customers against four institutions' banlists) through all five stages and
ends on a side-by-side summary. No data or setup is needed.

| Stage | Technique                                               | What the querier learns                                      | What breaks it                                           |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| 0     | Plaintext                                               | Every banlist, including people who were never its customers | Nothing needed                                           |
| 1     | SHA-256 hashing                                         | Hashes of every banlist entry                                | Guessable identifiers can be matched                     |
| 2     | Two-party PSI (Diffie–Hellman on ristretto255)          | Only which of its customers are flagged                      | A querier can pad its list with made-up "customers"      |
| 3     | Multi-party PSI                                         | The same, plus which institution flagged whom                | Attribution leaks                                        |
| 4     | DP risk scores via a coordinator, with a privacy budget | A noisy count per customer, no names                         | Out of scope: a colluding coordinator, malicious parties |

On every stage page:

- **Run** executes the real protocol across Web Workers. The **wire inspector** shows every
  message, its size, and what an eavesdropper would see.
- **What just happened** explains the run in plain words: who sent what, what the querier found
  against ground truth, and what each side could not see.
- **God view** reveals the synthetic data, so you can check results yourself.
- **Customers** sets the size (100 to 10,000), with an estimated run time before you press Run.
- Each stage links to a **theory page** with the math, a worked example computed live, and
  references to the papers and standards behind it.
- Stage 4 adds an **ε slider** with a chart of tier accuracy against ε, and a **privacy budget**
  that refuses runs once it is spent.

All data is synthetic and generated from a seed: names come from common-name lists, and no
record corresponds to a real person.

## How it is built

```
src/
  data/        seeded generator, normalizer, presets, ground truth
  protocol/    Protocol contract, in-memory channel, shared screening types
  runtime/     one Web Worker per party, main-thread relay and wire log
  crypto/      CSPRNG helpers, SHA-256/HMAC, ristretto255 wrappers (@noble/curves)
  protocols/   plaintext, hashing, psi (two- and multi-party), dprisk (coordinator)
  dp/          exact discrete Laplace sampler, budget ledger, accuracy bounds
  attacks/     candidate generators, scoring, fishing
  ui/          React stage pages, explainers, theory pages, walkthrough, summary
```

Every protocol is written once against a small `Protocol` interface and runs unchanged either on
an in-memory channel (unit tests) or across Web Workers (the app). Vite + React 19 + TypeScript,
deployed as a static site to GitHub Pages; no backend.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end tests (Playwright) against a local preview build
npm run check      # everything CI runs: typecheck, lint, format, unit, build, e2e
```

Run the end-to-end suite against a deployed site with `BASE_URL=<url> npm run e2e`.

Every push to `main` runs CI. When CI passes, the site deploys to GitHub Pages and the end-to-end
suite runs again against the live URL.

## Tests

231 unit tests and 39 end-to-end tests. Tests are named as claims (for example
`querier_never_holds_both_double_blinded_sets`). They cover:

- every protocol's result against ground truth, across seeds, sizes and match fields (property
  tests with fast-check);
- what each party can and cannot see on the wire;
- the noise sampler's distribution and the ledger's arithmetic;
- every page in a real browser, including a full walkthrough and an accessibility scan (axe).

Open items for the author are tracked in [BACKLOG.md](BACKLOG.md).
