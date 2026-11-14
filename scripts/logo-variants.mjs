// Logo variants (1024 box). Each exports { defs, bg, mark(scale) } so make-icons.mjs can reuse the picked one.
export const VARIANTS = {
  A: {
    title: 'A — Indigo arrows',
    defs: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f7cff"/><stop offset="1" stop-color="#2a3fbf"/></linearGradient>`,
    bg: `<rect width="1024" height="1024" fill="url(#g)"/>`,
    mark: (s = 1) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">
      <circle cx="512" cy="512" r="54" fill="#9fe3ff"/>
      <g fill="none" stroke="#fff" stroke-width="56" stroke-linecap="round" stroke-linejoin="round">
        <path d="M300 370 H700"/><path d="M620 290 L700 370 L620 450"/>
        <path d="M724 654 H324"/><path d="M404 574 L324 654 L404 734"/></g></g>`,
  },
  B: {
    title: 'B — Sky cycle',
    defs: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>`,
    bg: `<rect width="1024" height="1024" fill="url(#g)"/>`,
    mark: (s = 1) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">
      <g fill="none" stroke="#fff" stroke-width="60" stroke-linecap="round" stroke-linejoin="round">
        <path d="M296 470 A220 220 0 0 1 700 380"/><path d="M700 260 L712 390 L584 404"/>
        <path d="M728 554 A220 220 0 0 1 324 644"/><path d="M324 764 L312 634 L440 620"/></g>
      <text x="512" y="575" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="190" fill="#fff">$</text></g>`,
  },
  C: {
    title: 'C — Navy glow',
    defs: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14204a"/><stop offset="1" stop-color="#070b1d"/></linearGradient>
      <linearGradient id="s" gradientUnits="userSpaceOnUse" x1="300" y1="0" x2="724" y2="0"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#60a5fa"/></linearGradient>
      <linearGradient id="s2" gradientUnits="userSpaceOnUse" x1="724" y1="0" x2="300" y2="0"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
      <filter id="f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>`,
    bg: `<rect width="1024" height="1024" fill="url(#g)"/>`,
    mark: (s = 1) => {
      const arrows = (w) => `<g fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">
        <g stroke="url(#s)"><path d="M300 400 H700"/><path d="M620 320 L700 400 L620 480"/></g>
        <g stroke="url(#s2)"><path d="M724 624 H324"/><path d="M404 544 L324 624 L404 704"/></g></g>`;
      return `<g transform="translate(512 512) scale(${s}) translate(-512 -512)"><g filter="url(#f)" opacity="0.85">${arrows(70)}</g>${arrows(48)}</g>`;
    },
  },
};
export const svg = (v, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${v.defs}</defs>${body}</svg>`);
