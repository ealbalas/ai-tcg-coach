import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

function uniqueEmail() {
  return `test-${randomBytes(4).toString('hex')}@example.com`;
}

const PASSWORD = 'password123';

test.describe('Registration', () => {
  test('registers a new user and redirects to /games', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('At least 8 characters').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/games');
    await expect(page).toHaveURL(/\/games$/);
  });
});

test.describe('Login', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    testEmail = uniqueEmail();
    const page = await browser.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('At least 8 characters').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/games');
    await page.close();
  });

  test('logs in with valid credentials and redirects to /games', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Your password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/games');
    await expect(page).toHaveURL(/\/games$/);
  });

  test('auth persists after page reload', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Your password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/games');

    await page.reload();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByRole('heading', { name: 'Game History' })).toBeVisible();
  });
});
