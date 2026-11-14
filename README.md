# Курс НБКР — конвертер валют (Android)

До 7 валют на экране, ввод в любой строке пересчитывает остальные по официальному курсу
Национального банка КР (`nbkr.kg/XML/daily.xml` + `weekly.xml`, ~50 валют). Работает офлайн
на последних сохранённых курсах. Без рекламы, аналитики и API-ключей.

**Скачать APK:** https://github.com/SonArtyom/kurs-kg/releases/latest

## Разработка

```bash
npm install
npm run dev        # http://localhost:5173, курсы идут через прокси Vite /nbkr
npm test           # пересчёт и разбор XML
npm run build      # dist/
npx cap sync android && cd android && ./gradlew assembleRelease
```

- Деньги считаются в BigInt (масштаб 10⁻⁸), кросс-курс через KGS, одно округление half-up.
- В APK `fetch` идёт через нативный HTTP (`CapacitorHttp`), поэтому отсутствие CORS у nbkr.kg не мешает.
- Подпись: `android/app/build.gradle` берёт ключ из env (`KURSKG_*`, CI) или из `keystore.properties` вне репо.
- Релиз: `git tag v1.0.1 && git push --tags` — Actions соберёт APK и выложит в Releases.
- Офлайн-снимок для первого запуска без сети: `node scripts/snapshot.mjs`.
