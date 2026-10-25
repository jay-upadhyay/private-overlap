import { expect, test } from '@playwright/test';

test('debug_data_page_shows_presets', async ({ page }) => {
  await page.goto('./#/debug/data');
  await expect(page.getByTestId('truth-summary')).toContainText('490 of 10,000 customers are flagged');
  await page.getByLabel('Preset').selectOption('portfolio');
  await expect(page.getByTestId('truth-summary')).toContainText('400 of 10,000 customers are flagged');
});

test('debug_page_is_not_in_nav', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('navigation', { name: 'Stages' }).getByRole('link')).toHaveCount(7);
  await expect(page.getByRole('link', { name: /debug/i })).toHaveCount(0);
});

test('footer_links_to_the_test_data_page', async ({ page }) => {
  await page.goto('./#/stage/psi');
  await page.getByTestId('footer-test-data').click();
  await expect(page.getByTestId('debug-data')).toBeVisible();
  await expect(page.getByTestId('truth-summary')).toContainText('customers are flagged');
});
