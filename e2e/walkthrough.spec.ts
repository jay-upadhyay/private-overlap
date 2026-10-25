import { expect, test } from '@playwright/test';

const STAGE_IDS = ['plaintext', 'hashing', 'psi', 'multi-psi', 'dp-risk'];

test('full_walkthrough', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('start-walkthrough').click();
  for (const [i, id] of STAGE_IDS.entries()) {
    await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
    await expect(page.getByTestId('walkthrough-banner')).toContainText(`stage ${i + 1} of 5`);
    // The scenario chosen at the start is carried to every stage.
    await expect(page.getByTestId('preset-picker')).toHaveValue('consortium');
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
    await page.getByTestId('next-stage').click();
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  for (const id of STAGE_IDS) {
    await expect(page.getByTestId(`summary-${id}-scenario`)).toContainText('Consortium screen');
  }
  // One scenario throughout, so the comparison is like for like and the bottom line appears.
  await expect(page.getByTestId('scenario-same')).toBeVisible();
  await expect(page.getByTestId('bottom-line')).toContainText('found exactly the right customers');
  await expect(page.getByTestId('summary-plaintext-banned')).toContainText('readable');
  await expect(page.getByTestId('summary-hashing-banned')).toContainText('as hashes');
  await expect(page.getByTestId('summary-psi-banned')).toHaveText('None');
  await expect(page.getByTestId('summary-dp-risk-accuracy')).toContainText('of tiers match');
});

test('nav_walkthrough_button_starts_the_tour', async ({ page }) => {
  await page.goto('./#/stage/psi');
  await page.getByTestId('nav-walkthrough').click();
  await expect(page.getByTestId('stage-plaintext')).toBeVisible();
  await expect(page.getByTestId('walkthrough-banner')).toContainText('stage 1 of 5');
});

test('mixed_scenarios_warn_on_summary', async ({ page }) => {
  await page.goto('./#/stage/plaintext');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done');
  await page.goto('./#/stage/multi-psi');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
  await page.getByRole('link', { name: 'Summary' }).click();
  await expect(page.getByTestId('scenario-warning')).toContainText('2 different scenarios');
  await expect(page.getByTestId('bottom-line')).toHaveCount(0);
});

test('theory_pages_render_math_and_link_back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const id of STAGE_IDS) {
    await page.goto(`./#/theory/${id}`);
    await expect(page.getByTestId(`theory-${id}`)).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible();
    await expect(page.getByTestId('theory-example')).toBeVisible();
    await page.getByTestId('theory-to-stage').click();
    await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
    await expect(page.getByTestId('stage-to-theory')).toHaveAttribute('href', `#/theory/${id}`);
  }
  expect(errors).toEqual([]);
});
