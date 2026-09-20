import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

function uniqueEmail() {
  return `test-${randomBytes(4).toString('hex')}@example.com`;
}

const PASSWORD = 'password123';

async function registerAndGoToCards(page: import('@playwright/test').Page) {
  const email = uniqueEmail();
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL('**/games');
  await page.goto('/cards');
  await page.waitForSelector('[data-testid="card-tile"]', { timeout: 15000 });
}

const cardCountSummary = (page: import('@playwright/test').Page) =>
  page.locator('text=/Showing [\\d,]+ cards?/');

async function getCardCount(page: import('@playwright/test').Page): Promise<number> {
  const text = await cardCountSummary(page).textContent();
  const raw = text?.match(/[\d,]+/)?.[0] ?? '0';
  return parseInt(raw.replace(/,/g, ''), 10);
}

test.describe('Card database browser', () => {
  test('shows color filter pills for all 6 colors', async ({ page }) => {
    await registerAndGoToCards(page);
    for (const color of ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Black']) {
      await expect(page.getByRole('button', { name: color })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'All Colors' })).toBeVisible();
  });

  test('Red color filter reduces card count', async ({ page }) => {
    await registerAndGoToCards(page);

    const totalBefore = await getCardCount(page);
    expect(totalBefore).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Red' }).click();
    await expect(cardCountSummary(page)).toContainText('· Red', { timeout: 3000 });

    const totalAfter = await getCardCount(page);
    expect(totalAfter).toBeGreaterThan(0);
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  test('type + color combined filter narrows results', async ({ page }) => {
    await registerAndGoToCards(page);

    await page.getByRole('button', { name: 'Leader' }).click();
    await expect(cardCountSummary(page)).toContainText('· Leader', { timeout: 3000 });
    const leaderCount = await getCardCount(page);

    await page.getByRole('button', { name: 'Red' }).click();
    await expect(cardCountSummary(page)).toContainText('· Leader · Red', { timeout: 3000 });
    const comboCount = await getCardCount(page);

    expect(comboCount).toBeGreaterThan(0);
    expect(comboCount).toBeLessThanOrEqual(leaderCount);
  });

  test('search narrows results and shows filter summary', async ({ page }) => {
    await registerAndGoToCards(page);

    await page.getByPlaceholder('Search by card name...').fill('Luffy');
    await expect(cardCountSummary(page)).toContainText('"Luffy"', { timeout: 3000 });

    const count = await getCardCount(page);
    expect(count).toBeGreaterThan(0);
  });

  test('no-results state shows clear filters button that resets', async ({ page }) => {
    await registerAndGoToCards(page);

    await page.getByPlaceholder('Search by card name...').fill('xyznotexist99999');
    await expect(page.getByText('No cards found')).toBeVisible({ timeout: 3000 });

    const clearBtn = page.getByRole('button', { name: 'Clear filters' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(page.getByText('No cards found')).not.toBeVisible({ timeout: 3000 });
    const count = await getCardCount(page);
    expect(count).toBeGreaterThan(0);
  });
});
