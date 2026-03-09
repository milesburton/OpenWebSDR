import { test, expect } from '@playwright/test';

const UI_URL = process.env['UI_URL'] ?? 'http://localhost:8888';

test.describe('Web UI smoke tests', () => {
  test('UI loads and shows title', async ({ page }) => {
    await page.goto(UI_URL);
    await expect(page).toHaveTitle(/Next SDR/i);
  });

  test('Receivers panel renders', async ({ page }) => {
    await page.goto(UI_URL);
    await expect(page.getByText('Receivers', { exact: false })).toBeVisible();
  });

  test('Tune panel renders with frequency input', async ({ page }) => {
    await page.goto(UI_URL);
    await expect(page.getByText('Tune', { exact: false })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: /frequency/i })).toBeVisible();
  });

  test('Waterfall panel renders placeholder when not tuned', async ({ page }) => {
    await page.goto(UI_URL);
    await expect(page.getByText(/tune to a frequency/i)).toBeVisible();
  });

  test('Can submit a tune request', async ({ page }) => {
    await page.goto(UI_URL);

    // Wait for WS connection
    await page.waitForSelector('text=WS: connected', { timeout: 15_000 });

    const freqInput = page.getByRole('spinbutton', { name: /frequency/i });
    await freqInput.fill('145.500');

    await page.getByRole('button', { name: /tune/i }).click();

    // After tuning, the session ID should appear
    await expect(page.getByText(/session:/i)).toBeVisible({ timeout: 10_000 });
  });
});
