import { expect, test } from '@playwright/test';

test('the phone layout has a bottom tab bar and no sideways scrolling', async ({ page }) => {
  await page.goto('/');
  const tabs = page.getByRole('navigation').last();
  await expect(tabs).toBeVisible();
  for (const path of ['/', '/books', '/community', '/clubs', '/student-zone']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
