// Renders the app icons, splash and notification icon from the web logo (web/public/icon.svg),
// so web and mobile share one source. Run after changing the logo: node scripts/generate-icons.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = fileURLToPath(new URL('../assets/', import.meta.url));
const svg = await readFile(fileURLToPath(new URL('../../web/public/icon.svg', import.meta.url)));
const BLUE = '#2563EB';
const logo = (size) => sharp(svg, { density: 1024 }).resize(size, size).png().toBuffer();
const onBlue = async (size, inner, file) =>
  sharp({ create: { width: size, height: size, channels: 4, background: BLUE } })
    .composite([{ input: await logo(Math.round(size * inner)), gravity: 'center' }])
    .png()
    .toFile(out + file);

// iOS and the store listing: the mark on brand blue, no transparency.
await onBlue(1024, 0.78, 'icon.png');
// Android adaptive icon: launchers mask to any shape, so the mark stays inside the 66% safe zone.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await logo(560), gravity: 'center' }])
  .png()
  .toFile(out + 'android-icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLUE } }).png().toFile(out + 'android-icon-background.png');
// Monochrome (themed icons) and the notification icon use only the alpha channel: the open book in white.
const book = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M3 12.2c5-1.8 10.4-1.3 15.8 2v19.6C13.4 30.6 8 30 3 31.8z" fill="#fff"/><path d="M37 12.2c-5-1.8-10.4-1.3-15.8 2v19.6c5.4-3.2 10.8-3.8 15.8-2z" fill="#fff"/><circle cx="20" cy="6" r="3" fill="#fff"/></svg>',
);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(book, { density: 1024 }).resize(520, 520).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile(out + 'android-icon-monochrome.png');
await sharp(book, { density: 512 }).resize(96, 96).png().toFile(out + 'notification-icon.png');
await sharp(svg, { density: 1024 }).resize(512, 512).png().toFile(out + 'splash-icon.png');
await sharp(svg, { density: 512 }).resize(48, 48).png().toFile(out + 'favicon.png');
console.log('mobile icons written');
