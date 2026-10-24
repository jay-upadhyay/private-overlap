import { expect, test } from '@playwright/test';

test('module_worker_round_trip', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('worker-health')).toHaveText('Workers: ready');
});
