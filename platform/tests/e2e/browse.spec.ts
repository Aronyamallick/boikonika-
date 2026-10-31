import { expect, test } from '@playwright/test';
import { printedBook } from '../support';

test('home page in Bangla, then English with the language switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('link', { name: /বইকণিকা/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /^EN/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('search finds a book, and its page shows buying options', async ({ page }) => {
  const book = await printedBook();
  await page.goto('/en/search?q=' + encodeURIComponent(book.title));
  await page.getByRole('link', { name: book.title }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: book.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Buy from a seller' })).toBeVisible();
});

test('a guest can fill a cart before signing in', async ({ page }) => {
  const book = await printedBook();
  await page.goto(`/en/books/${book.slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByText('Added to your cart').or(page.getByText(/added to (your )?cart/i)).first()).toBeVisible();
  await page.goto('/en/cart');
  await expect(page.getByRole('link', { name: book.title }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in to check out' }).or(page.getByRole('button', { name: /check ?out/i })).first()).toBeVisible();
});

test('missing pages answer 404 and the sitemap lists public pages', async ({ page, request }) => {
  const res = await page.goto('/en/books/this-book-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('/books/');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /account/');
});
