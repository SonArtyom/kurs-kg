// Renders the app icon sources for @capacitor/assets (run: node scripts/make-icons.mjs && npx capacitor-assets generate --android)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BG = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#17b487"/><stop offset="1" stop-color="#0a6b52"/></linearGradient>`;

// Two opposing arrows + a small "sun" (nod to the Kyrgyz flag). Drawn in a 1024 box, centered in the 66% safe zone.
const mark = (s = 1) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">
  <circle cx="512" cy="512" r="54" fill="#ffd23f"/>
  <g fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round" stroke-linejoin="round">
    <path d="M300 370 H700"/><path d="M620 290 L700 370 L620 450"/>
    <path d="M724 654 H324"/><path d="M404 574 L324 654 L404 734"/>
  </g>
</g>`;

const svg = (body, defs = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}${BG}</defs>${body}</svg>`);

mkdirSync('assets', { recursive: true });
await sharp(svg(`<rect width="1024" height="1024" fill="url(#g)"/>${mark(1)}`)).png().toFile('assets/icon-only.png');
await sharp(svg(mark(0.62))).png().toFile('assets/icon-foreground.png');
await sharp(svg(`<rect width="1024" height="1024" fill="url(#g)"/>`)).png().toFile('assets/icon-background.png');
const splash = (bg) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><defs>${BG}</defs><rect width="2732" height="2732" fill="${bg}"/><g transform="translate(1110 1110) scale(0.5)"><rect width="1024" height="1024" rx="230" fill="url(#g)"/>${mark(1)}</g></svg>`);
await sharp(splash('#f3f4f6')).png().toFile('assets/splash.png');
await sharp(splash('#0d0f12')).png().toFile('assets/splash-dark.png');
console.log('icons ok');
