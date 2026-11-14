import sharp from 'sharp';
import { VARIANTS, svg } from './logo-variants.mjs';
const tiles = [];
for (const [k, v] of Object.entries(VARIANTS)) {
  const full = await sharp(svg(v, v.bg + v.mark(1))).resize(300, 300).png().toBuffer();
  tiles.push({ k, v, b64: full.toString('base64') });
}
const W = 1200, H = 760;
const col = (i) => 60 + i * 380;
let body = `<rect width="${W}" height="380" fill="#eef1f6"/><rect y="380" width="${W}" height="380" fill="#0d0f12"/>`;
tiles.forEach((t, i) => {
  for (const [y, fg, r] of [[40, '#101318', 66], [420, '#f1f3f6', 150]]) {
    body += `<clipPath id="c${i}${y}"><rect x="${col(i)}" y="${y}" width="300" height="300" rx="${r}"/></clipPath>
      <image href="data:image/png;base64,${t.b64}" x="${col(i)}" y="${y}" width="300" height="300" clip-path="url(#c${i}${y})"/>
      <text x="${col(i) + 150}" y="${y + 330}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="22" fill="${fg}">${t.v.title}</text>`;
  }
});
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">${body}</svg>`)).png().toFile('previews/logo-variants.png');
console.log('ok');
