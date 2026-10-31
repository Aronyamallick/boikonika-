import { expect, test } from '@playwright/test';
import { lastCode, printedBook, signIn, signUp } from '../support';

test('sign up with a mobile number and its code, sign out, and sign in again', async ({ page }) => {
  const phone = '018' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  await page.goto('/en/register');
  await page.getByLabel('Full name').fill('Nusrat Jahan');
  await page.getByLabel('Email or mobile number').fill(phone);
  await page.getByLabel(/^Password/).fill('reader-pass-2026');
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill(await lastCode('+88' + phone));
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: /^Account menu/ })).toBeVisible();

  await page.getByRole('button', { name: /^Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible();

  await signIn(page, phone, 'reader-pass-2026');
  await expect(page.getByRole('button', { name: /^Account menu/ })).toBeVisible();
});

test('a reader puts a book on a library shelf', async ({ page }) => {
  await signUp(page, 'Library Reader');
  const book = await printedBook();
  await page.goto(`/en/books/${book.slug}`);
  await page.getByLabel('Shelf in my library').selectOption('want_to_read');
  await expect(page.getByLabel('Shelf in my library')).toHaveValue('want_to_read');
  await page.goto('/en/library');
  await expect(page.getByRole('link', { name: book.title }).first()).toBeVisible();
});
