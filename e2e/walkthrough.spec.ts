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
  for (const id of STAGE_IDS)
    await expect(page.getByTestId(`summary-${id}`)).not.toContainText('Not run yet');
  await expect(page.getByTestId('summary-plaintext')).toContainText('identifiers readable');
  await expect(page.getByTestId('summary-psi')).toContainText('no readable identifiers');
  await expect(page.getByTestId('summary-dp-risk')).toContainText('of tiers exact at ε 0.5');
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
