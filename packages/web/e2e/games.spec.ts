import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.txt');

function uniqueEmail() {
  return `test-${randomBytes(4).toString('hex')}@example.com`;
}

const PASSWORD = 'password123';

async function registerAndLogin(page: import('@playwright/test').Page) {
  const email = uniqueEmail();
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL('**/games');
}

test.describe('Games page', () => {
  test('renders game list without error (empty state)', async ({ page }) => {
    await registerAndLogin(page);
    await expect(page.getByRole('heading', { name: 'Game History' })).toBeVisible();
    await expect(page.getByText('No games uploaded yet')).toBeVisible();
  });

  test('upload flow - new game row appears after upload', async ({ page }) => {
    await registerAndLogin(page);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Upload a game' }).click(),
    ]);
    await fileChooser.setFiles(FIXTURE);

    await expect(page.getByText('No games uploaded yet')).not.toBeVisible({ timeout: 10000 });
    const gameRows = page.locator('a[href^="/games/"]');
    await expect(gameRows).toHaveCount(1, { timeout: 10000 });
  });
});
