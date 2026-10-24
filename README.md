# Private Overlap

Screen customers against other institutions' banlists without either side revealing its list.
An interactive explainer that walks from plain hashing to private set intersection (PSI) to
differential privacy (DP), showing the attack that breaks each stage.

Status: **P0 scaffold**. Stage pages are placeholders.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end tests (Playwright) against a local preview build
npm run check      # everything CI runs
```

Run the end-to-end suite against a deployed site with `BASE_URL=<url> npm run e2e`.

## Deploy

Every push to `main` runs CI. When CI passes, the site deploys to GitHub Pages and the
end-to-end suite runs again against the live URL.
