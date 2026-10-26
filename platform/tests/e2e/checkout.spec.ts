import { expect, test } from '@playwright/test';
import { printedBook, signUp } from '../support';

test('a reader orders a printed book with cash on delivery, then cancels it', async ({ page }) => {
  await signUp(page, 'Checkout Reader');
  const book = await printedBook();
  await page.goto(`/en/books/${book.slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await page.goto('/en/checkout');

  await page.getByRole('button', { name: 'Add a new address' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel("Recipient's name").fill('Checkout Reader');
  await dialog.getByLabel('Mobile number').fill('01712345678');
  await dialog.getByLabel('Division').selectOption('dhaka');
  await dialog.getByLabel('District').selectOption('dhaka');
  await dialog.getByLabel('Upazila / Thana').fill('Dhanmondi');
  await dialog.getByLabel('Area / Village').fill('Road 27');
  await dialog.getByLabel('House, road, flat').fill('House 12, Road 4');
  await dialog.getByRole('button', { name: 'Deliver here' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('radio', { name: /Cash on delivery/ }).check();
  await expect(page.getByText('Total').last()).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page).toHaveURL(/\/en\/account\/orders\/BK/);
  await expect(page.getByText(book.title).first()).toBeVisible();
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByLabel('Why are you cancelling?').fill('Ordered by mistake');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByText(/Cancelled/).first()).toBeVisible();
});
