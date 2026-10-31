// Renders the PWA / home-screen icons from public/icon.svg (run after changing the logo).
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const svg = await readFile(`${root}icon.svg`);
await mkdir(`${root}icons`, { recursive: true });

const plain = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of plain) await sharp(svg, { density: 512 }).resize(size, size).png().toFile(`${root}icons/${name}`);

// Maskable: the logo inside the 80% safe zone on the brand blue, so launchers can crop it to any shape.
const size = 512;
const inner = Math.round(size * 0.72);
const logo = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
await sharp({ create: { width: size, height: size, channels: 4, background: '#2563EB' } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(`${root}icons/icon-maskable-512.png`);
// Notification badge: Android shows only its alpha channel, so it's the open book alone, in white.
const badge = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M3 12.2c5-1.8 10.4-1.3 15.8 2v19.6C13.4 30.6 8 30 3 31.8z" fill="#fff"/><path d="M37 12.2c-5-1.8-10.4-1.3-15.8 2v19.6c5.4-3.2 10.8-3.8 15.8-2z" fill="#fff"/><circle cx="20" cy="6" r="3" fill="#fff"/></svg>',
);
await sharp(badge, { density: 512 }).resize(96, 96).png().toFile(`${root}icons/badge-96.png`);
console.log('icons written');
