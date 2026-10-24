// The seeded RandomSource in src/test/fixtures.ts must never ship: DP noise from a guessable seed
// is no noise at all. Build the app, and the DP module on its own (nothing imports it yet), and
// check neither bundle carries anything unique to the fixtures file.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const FIXTURE_MARKERS = ['seededSource', 'smallScenario', 'Test Querier', 'Test Holder'];
const outDir = mkdtempSync(join(tmpdir(), 'dp-bundle-'));

function bundledJs(dir: string): string {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('dp/bundle', () => {
  it('no_seeded_source_in_bundle', { timeout: 60_000 }, async () => {
    const app = join(outDir, 'app');
    const dp = join(outDir, 'dp');
    await build({ logLevel: 'silent', build: { outDir: app, emptyOutDir: true } });
    await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        outDir: dp,
        emptyOutDir: true,
        minify: false,
        lib: { entry: 'src/dp/index.ts', formats: ['es'], fileName: 'dp' },
      },
    });

    const appJs = bundledJs(app);
    const dpJs = bundledJs(dp);
    // Sanity: the builds really contain the code under test.
    expect(appJs.length).toBeGreaterThan(1000);
    expect(dpJs).toContain('sampleDiscreteLaplace');
    for (const marker of FIXTURE_MARKERS) {
      expect(appJs, marker).not.toContain(marker);
      expect(dpJs, marker).not.toContain(marker);
    }
  });
});
