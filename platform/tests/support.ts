import { expect, type Page } from '@playwright/test';

export const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api/v1';
export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com', password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin-Pass-2026' };

const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'boikonika', 'Accept-Language': 'en' };

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method, headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json()) as { success: boolean; data: T; message: string };
  if (!json.success) throw new Error(`${method} ${path} → ${res.status}: ${json.message}`);
  return json.data;
}

/** The newest code the development API "sent" to a phone or email (development builds keep an outbox). */
export async function lastCode(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const messages = await call<Array<{ text: string }>>('GET', `/dev/outbox?to=${encodeURIComponent(to)}`);
    const code = messages[0]?.text.match(/\b(\d{6})\b/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no code sent to ${to}`);
}

/** A fresh reader account, created through the API like the sign-up form does. */
export async function newReader(name = 'E2E Reader'): Promise<{ phone: string; password: string; token: string; username: string }> {
  const phone = '017' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const password = 'e2e-pass-2026';
  await call('POST', '/auth/otp/request', { target: phone, purpose: 'register' });
  const code = await lastCode('+88' + phone);
  const result = await call<{ user: { username: string }; tokens: { accessToken: string } }>('POST', '/auth/register', { name, target: phone, code, password, acceptTerms: true, client: 'android', deviceId: 'e2e-device-' + phone });
  return { phone, password, token: result.tokens.accessToken, username: result.user.username };
}

/** Signs in through the website's form (English UI). */
export async function signIn(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/en/login');
  await page.getByLabel('Email or mobile number').fill(identifier);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A book that is on sale, from the API (demo catalogue). */
export async function bookOnSale(): Promise<{ slug: string; title: string }> {
  const books = await call<Array<{ slug: string; title: string; inStock: boolean }>>('GET', '/books?sort=popular&inStock=1&pageSize=5');
  if (!books[0]) throw new Error('no books on sale — seed the demo catalogue');
  return books[0];
}

/** Signs up a new reader through the website's form (English UI) and leaves them signed in. */
export async function signUp(page: Page, name: string): Promise<{ phone: string; password: string }> {
  const phone = '01' + String(3 + Math.floor(Math.random() * 7)) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const password = 'reader-pass-2026';
  await page.goto('/en/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email or mobile number').fill(phone);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill(await lastCode('+88' + phone));
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: /^Account menu/ })).toBeVisible();
  return { phone, password };
}

/** A book whose cheapest copy on sale is a printed one (so checkout needs a delivery address). */
export async function printedBook(): Promise<{ slug: string; title: string }> {
  const books = await call<Array<{ slug: string; title: string }>>('GET', '/books?sort=popular&inStock=1&pageSize=30');
  for (const b of books) {
    const detail = await call<{ offers: Array<{ isDigital: boolean; stock: number; price: string; variantId: string | null }> }>('GET', `/books/${encodeURIComponent(b.slug)}`);
    const onSale = detail.offers.filter((o) => o.variantId && (o.isDigital || o.stock > 0)).sort((x, y) => Number(x.price) - Number(y.price));
    if (onSale[0] && !onSale[0].isDigital) return b;
  }
  throw new Error('no printed book in stock — seed the demo catalogue');
}

export const api = { call };
