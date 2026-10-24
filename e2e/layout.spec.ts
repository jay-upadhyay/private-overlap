import { expect, test, type Page } from '@playwright/test';

const STAGE_IDS = ['plaintext', 'hashing', 'psi', 'multi-psi', 'dp-risk'];

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test('explainer_collapses_and_persists', async ({ page }) => {
  await page.goto('./#/stage/psi');
  const body = page.getByTestId('explainer-body');
  await expect(body).toBeVisible();
  await page.getByRole('button', { name: 'How this stage works' }).click();
  await expect(body).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('stage-psi')).toBeVisible();
  await expect(body).toBeHidden();

  // Each stage remembers its own state, so another stage still opens on first visit.
  await page.goto('./#/stage/hashing');
  await expect(page.getByTestId('explainer-body')).toBeVisible();
});

test('run_fills_wire_and_results', async ({ page }) => {
  await page.goto('./#/stage/multi-psi');
  await expect(page.getByTestId('wire-entry')).toHaveCount(0);
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done');
  // Consortium preset, multi-party PSI: blinded customers out, re-blinded customers and the
  // blinded banlist back, for each of 4 holders.
  await expect(page.getByTestId('wire-entry')).toHaveCount(12);
  await expect(page.getByTestId('wire-entry').first()).toContainText('Eavesdropper sees:');
  const tally = page.getByTestId('results-tally');
  await expect(tally).toContainText('Missed0');
  await expect(tally).toContainText('Extra0');
  await expect(page.getByRole('columnheader', { name: 'Meridian' })).toBeVisible();

  // The attack demo is wired in, so its button replaces the "not built yet" note.
  await expect(page.getByTestId('run-attack')).toBeVisible();
  await expect(page.getByTestId('attack-not-built')).toHaveCount(0);
});

test('mobile_width_has_no_horizontal_scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const id of STAGE_IDS) {
    await page.goto(`./#/stage/${id}`);
    await page.getByTestId('god-view-toggle').check();
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done');
    expect(await hasHorizontalScroll(page), id).toBe(false);
  }
});
