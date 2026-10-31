import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, bookOnSale, signIn } from '../support';

/** WCAG 2.1 A and AA rules, as axe implements them. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = violations.map((v) => `${v.impact} ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n    ')}`);
  expect(report, `${path}\n${report.join('\n')}`).toEqual([]);
}

const PUBLIC = ['/', '/books', '/search?q=%E0%A6%AC%E0%A6%87', '/community', '/clubs', '/student-zone', '/challenges', '/authors', '/help', '/blog', '/contact', '/pages/terms', '/login', '/register', '/cart', '/no-such-page'];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PUBLIC) {
      test(`Bangla ${path}`, async ({ page }) => audit(page, path));
    }
    test('English home and book page', async ({ page }) => {
      const book = await bookOnSale();
      await audit(page, '/en');
      await audit(page, `/en/books/${book.slug}`);
      await audit(page, `/books/${book.slug}`);
    });
  });
}

test('signed-in pages', async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  for (const path of ['/en/library', '/en/account/orders', '/en/notifications', '/en/account/profile', '/en/admin']) await audit(page, path);
});
