import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.sonartyom.kurskg',
  appName: 'Курс НБКР',
  webDir: 'dist',
  plugins: {
    // Route fetch() through native HTTP: NBKR has no CORS headers.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
