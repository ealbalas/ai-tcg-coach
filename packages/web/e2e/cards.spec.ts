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
  // Wait for card grid to be visible (cards loaded)
  await page.waitForSelector('[data-testid="card-tile"], .grid > div', { timeout: 15000 });
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

    // Get total card count before filtering
    const summaryBefore = await page.locator('text=/Showing \\d+ cards/').textContent();
    const totalBefore = parseInt(summaryBefore?.match(/\d+/)?.[0] ?? '0', 10);
    expect(totalBefore).toBeGreaterThan(0);

    // Apply Red filter
    await page.getByRole('button', { name: 'Red' }).click();
    await page.waitForTimeout(100);

    // Count should decrease
    const summaryAfter = await page.locator('text=/Showing \\d+ cards/').textContent();
    const totalAfter = parseInt(summaryAfter?.match(/\d+/)?.[0] ?? '0', 10);
    expect(totalAfter).toBeGreaterThan(0);
    expect(totalAfter).toBeLessThan(totalBefore);

    // Summary line should mention Red
    await expect(page.locator('text=/· Red/')).toBeVisible();
  });

  test('type + color combined filter narrows results', async ({ page }) => {
    await registerAndGoToCards(page);

    // Filter by Leader type
    await page.getByRole('button', { name: 'Leader' }).click();
    await page.waitForTimeout(100);
    const summaryLeader = await page.locator('text=/Showing \\d+ cards/').textContent();
    const leaderCount = parseInt(summaryLeader?.match(/\d+/)?.[0] ?? '0', 10);

    // Also filter by Red color
    await page.getByRole('button', { name: 'Red' }).click();
    await page.waitForTimeout(100);
    const summaryCombo = await page.locator('text=/Showing \\d+ cards/').textContent();
    const comboCount = parseInt(summaryCombo?.match(/\d+/)?.[0] ?? '0', 10);

    expect(comboCount).toBeGreaterThan(0);
    expect(comboCount).toBeLessThanOrEqual(leaderCount);

    // Summary line should mention both filters
    await expect(page.locator('text=/· Leader · Red/')).toBeVisible();
  });

  test('search narrows results and shows filter summary', async ({ page }) => {
    await registerAndGoToCards(page);

    // Type a search query
    await page.getByPlaceholder('Search by card name...').fill('Luffy');
    await page.waitForTimeout(400); // wait for debounce

    const summary = await page.locator('text=/Showing \\d+ cards/').textContent();
    const count = parseInt(summary?.match(/\d+/)?.[0] ?? '0', 10);
    expect(count).toBeGreaterThan(0);

    // Summary should include the search term
    await expect(page.locator('text=/"Luffy"/')).toBeVisible();
  });

  test('no-results state shows clear filters button that resets', async ({ page }) => {
    await registerAndGoToCards(page);

    await page.getByPlaceholder('Search by card name...').fill('xyznotexist99999');
    await page.waitForTimeout(400); // wait for debounce

    await expect(page.getByText('No cards found')).toBeVisible();
    const clearBtn = page.getByRole('button', { name: 'Clear filters' });
    await expect(clearBtn).toBeVisible();

    await clearBtn.click();
    await page.waitForTimeout(200);

    // After clearing, should show cards again
    await expect(page.getByText('No cards found')).not.toBeVisible();
    const summary = await page.locator('text=/Showing \\d+ cards/').textContent();
    const count = parseInt(summary?.match(/\d+/)?.[0] ?? '0', 10);
    expect(count).toBeGreaterThan(0);
  });
});
