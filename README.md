# Converter

Android currency converter using the official rates of the National Bank of the Kyrgyz Republic (NBKR).

- Up to 7 currencies on screen. Typing an amount in any row instantly recalculates all the others.
- Calculator in the amount field: `+ − × ÷ =`. For example, `250 + 250` gives 500, and every other row updates from 500.
- About 50 currencies from the NBKR feeds (`nbkr.kg/XML/daily.xml` and `weekly.xml`). You can add, remove and reorder them, and search the full list.
- Rates refresh on launch and then every hour. The last rates are cached, so the app works offline, and it shows the rate date plus a warning when the data is outdated or offline.
- Russian / English UI with a toggle. Light and dark theme follow the system.
- No ads, no analytics, no trackers, no API keys.

**Download the APK:** https://github.com/SonArtyom/kurs-kg/releases/latest

## Install on Android

1. Open the link above on your phone and download `Converter.apk`.
2. Open the file. If Android asks, allow installing apps from this source (your browser or Files app).
3. Tap **Install**. **Converter** appears on your home screen.

## Development

```bash
npm install
npm run dev        # http://localhost:5173, rates go through the Vite proxy /nbkr
npm test           # conversion math, calculator and NBKR XML parsing
npm run build      # dist/
npx cap sync android && cd android && ./gradlew assembleRelease
```

Stack: Vite + TypeScript (no framework) + Capacitor 8. The web bundle is under 10 KB gzip.

## How it works

- **Exact money math.** Amounts and rates are BigInt values scaled by 10⁻⁸. Every conversion is a cross rate through KGS with one half-up rounding at the end. Calculator expressions are evaluated as exact fractions.
- **No CORS proxy needed.** nbkr.kg sends no CORS headers. In the APK, `fetch` goes through native HTTP (`CapacitorHttp`), so the browser restriction does not apply.
- **Offline first launch.** `src/fallback.ts` bundles a rates snapshot. Refresh it with `node scripts/snapshot.mjs`.
- **Icons.** `node scripts/make-icons.mjs B && npx capacitor-assets generate --android`. The logo variants live in `scripts/logo-variants.mjs`.

## Releases

Bump `versionCode` / `versionName` in `android/app/build.gradle`, then:

```bash
git tag v1.2.0 && git push --tags
```

GitHub Actions runs the tests, builds a signed APK and attaches it to the release.

Signing: `android/app/build.gradle` reads the keystore from env vars (`KURSKG_*`, used by CI) or from a `keystore.properties` file kept outside the repo. CI needs the secrets `KEYSTORE_BASE64` and `KEYSTORE_PASSWORD`.
