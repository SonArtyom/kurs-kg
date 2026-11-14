import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  server: {
    host: true,
    // NBKR sends no CORS headers; in the browser dev server go through this proxy.
    // The APK uses native HTTP (CapacitorHttp) and talks to nbkr.kg directly.
    proxy: {
      '/nbkr': { target: 'https://www.nbkr.kg', changeOrigin: true, rewrite: (p) => p.replace(/^\/nbkr/, '') },
    },
  },
});
