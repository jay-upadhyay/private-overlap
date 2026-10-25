import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  './',
  './#/summary',
  ...['plaintext', 'hashing', 'psi', 'multi-psi', 'dp-risk'].flatMap((id) => [
    `./#/stage/${id}`,
    `./#/theory/${id}`,
  ]),
];

for (const path of PAGES) {
  test(`no_serious_violations ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.locator('main').waitFor();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`);
    expect(serious).toEqual([]);
  });
}
