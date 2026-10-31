import { expect, test } from '@playwright/test';
import { ADMIN, signIn, signUp } from '../support';

test('staff reach the admin overview and moderation queue', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto('/en/admin');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/en/admin/moderation');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('readers are kept out of the admin area', async ({ page }) => {
  await signUp(page, 'Curious Reader');
  await page.goto('/en/admin');
  await expect(page.getByText('You do not have access to this area.').first()).toBeVisible();
});
