import { expect, test } from '@playwright/test';
import { signUp } from '../support';

test('a reader posts in the community and comments on it', async ({ page }) => {
  await signUp(page, 'Community Reader');
  const text = `Which Bangla novel should I read this monsoon? (${Date.now()})`;
  await page.goto('/en/community');
  await page.getByRole('button', { name: /Share something about a book/ }).click();
  await page.getByLabel('What would you like to share?').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText(text)).toBeVisible();

  await page.getByRole('article').filter({ hasText: text }).getByRole('link', { name: /^Comments/ }).click();
  await page.getByLabel('Write a comment').fill('Try Shesher Kobita.');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText('Try Shesher Kobita.')).toBeVisible();
});
