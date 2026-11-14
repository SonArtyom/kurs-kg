// Renders icon sources for @capacitor/assets from the chosen logo variant.
// Run: node scripts/make-icons.mjs && npx capacitor-assets generate --android
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { VARIANTS, svg } from './logo-variants.mjs';

const v = VARIANTS[process.argv[2] ?? 'B'];
mkdirSync('assets', { recursive: true });
await sharp(svg(v, v.bg + v.mark(1))).png().toFile('assets/icon-only.png');
await sharp(svg(v, v.mark(0.62))).png().toFile('assets/icon-foreground.png');
await sharp(svg(v, v.bg)).png().toFile('assets/icon-background.png');
const splash = (bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><defs>${v.defs}</defs>
    <rect width="2732" height="2732" fill="${bg}"/>
    <g transform="translate(1110 1110) scale(0.5)"><clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath>
    <g clip-path="url(#r)">${v.bg}${v.mark(1)}</g></g></svg>`);
await sharp(splash('#f3f4f6')).png().toFile('assets/splash.png');
await sharp(splash('#0d0f12')).png().toFile('assets/splash-dark.png');
console.log('icons ok');
