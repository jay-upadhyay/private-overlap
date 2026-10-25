import { expect, test } from '@playwright/test';

// Each stage runs its real protocol in Web Workers and must match ground truth exactly.
const STAGES = [
  { id: 'plaintext', message: 'banlist' },
  { id: 'hashing', message: 'banlist-hashes' },
  { id: 'psi', message: 'psi/blinded' },
  { id: 'multi-psi', message: 'psi/blinded' },
];

for (const { id, message } of STAGES) {
  test(`${id}_real_protocol_matches_ground_truth`, async ({ page }) => {
    await page.goto(`./#/stage/${id}`);
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
    const tally = page.getByTestId('results-tally');
    await expect(tally).toContainText('Missed0');
    await expect(tally).toContainText('Extra0');
    await expect(page.getByTestId('wire-entry').filter({ hasText: message }).first()).toBeVisible();
    await expect(page.getByTestId('what-happened')).toContainText('customers on a banlist');
  });
}

test('psi_wire_carries_no_identifiers', async ({ page }) => {
  await page.goto('./#/stage/psi');
  await page.getByTestId('run-button').click();
  await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
  // Previews are hex of blinded points; no email-like text crosses the wire.
  await expect(page.getByTestId('wire-inspector')).not.toContainText('@');
});

test.describe('dp-risk', () => {
  const runAndWait = async (page: import('@playwright/test').Page, status: 'done' | 'error') => {
    await page.getByTestId('run-button').click();
    await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', status, { timeout: 30_000 });
  };

  test('scores_customers_and_charges_budget', async ({ page }) => {
    await page.goto('./#/stage/dp-risk');
    await expect(page.getByTestId('budget-remaining')).toHaveText('2000');
    await runAndWait(page, 'done');
    await expect(page.getByTestId('risk-tally')).toContainText('High risk');
    await expect(page.getByTestId('risk-accuracy')).toContainText('of 1,000 customers');
    await expect(page.getByTestId('budget-remaining')).toHaveText('1500');
    // No institution is named anywhere in the results.
    await expect(page.getByTestId('results-panel')).not.toContainText('Meridian');
  });

  test('full_size_run_is_refused', async ({ page }) => {
    await page.goto('./#/stage/dp-risk');
    await page.getByTestId('size-input').fill('10000');
    await expect(page.getByTestId('budget-next')).toHaveAttribute('data-ok', 'false');
    await runAndWait(page, 'error');
    await expect(page.getByTestId('run-status')).toContainText('Refused by the privacy budget');
    await expect(page.getByTestId('budget-remaining')).toHaveText('2000');
  });

  test('fourth_rescreen_is_refused', async ({ page }) => {
    await page.goto('./#/stage/dp-risk');
    for (let i = 0; i < 3; i++) await runAndWait(page, 'done');
    await runAndWait(page, 'error');
    await expect(page.getByTestId('run-status')).toContainText('lifetime cap');
  });

  test('epsilon_slider_sets_cost_and_marks_the_chart', async ({ page }) => {
    await page.goto('./#/stage/dp-risk');
    await expect(page.getByTestId('run-estimate')).toContainText('Costs ε 500 of the ε 2000 left');
    await page.getByTestId('epsilon-slider').fill('1');
    await expect(page.getByTestId('epsilon-value')).toHaveText('1.0');
    await expect(page.getByTestId('run-estimate')).toContainText('Costs ε 1000 of the ε 2000 left');
    await runAndWait(page, 'done');
    await expect(page.getByTestId('budget-remaining')).toHaveText('1000');
    await expect(page.getByTestId('run-dot')).toHaveCount(1);
  });

  test('chart_has_hover_tooltip_and_table', async ({ page }) => {
    await page.goto('./#/stage/dp-risk');
    const chart = page.getByTestId('accuracy-chart');
    await chart.hover({ position: { x: 150, y: 80 } });
    await expect(page.getByTestId('chart-tooltip')).toContainText('Tiers right');
    await page.getByText('Show as a table').click();
    await expect(page.getByTestId('epsilon-table')).toContainText('0.5');
  });
});
