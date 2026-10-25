import { expect, test } from '@playwright/test';

test('debug_data_page_shows_presets', async ({ page }) => {
  await page.goto('./#/debug/data');
  await expect(page.getByTestId('truth-summary')).toContainText('490 of 10,000 customers are flagged');
  await page.getByLabel('Preset').selectOption('portfolio');
  await expect(page.getByTestId('truth-summary')).toContainText('400 of 10,000 customers are flagged');
});

test('debug_page_is_not_in_nav', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('navigation', { name: 'Stages' }).getByRole('link')).toHaveCount(6);
  await expect(page.getByRole('link', { name: /debug/i })).toHaveCount(0);
});
