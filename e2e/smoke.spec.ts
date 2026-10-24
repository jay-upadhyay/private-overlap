import { expect, test } from '@playwright/test';

const STAGE_IDS = ['plaintext', 'hashing', 'psi', 'multi-psi', 'dp-risk'];

test('loads_every_stage_route', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  for (const id of STAGE_IDS) {
    await page.goto(`./#/stage/${id}`);
    await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('nav_links_switch_stage', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /Multi-party PSI/ }).click();
  await expect(page).toHaveURL(/#\/stage\/multi-psi$/);
  await expect(page.getByTestId('stage-multi-psi')).toBeVisible();
});

test('deep_link_survives_reload', async ({ page }) => {
  await page.goto('./#/stage/psi');
  await page.reload();
  await expect(page.getByTestId('stage-psi')).toBeVisible();
  await expect(page.getByRole('link', { name: /Two-party PSI/ })).toHaveAttribute('aria-current', 'page');
});
