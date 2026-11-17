// Molio – Nuxt 3 PWA
// A nyilvános demó statikus oldalként készül (`npm run generate` → .output/public), szerver és adatbázis nélkül:
// az adatok a böngésző tárolójában (IndexedDB) vannak. A végleges rendszer a Nitro szerverrel és PostgreSQL-lel fut.
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: false },
  ssr: false,
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],
  css: [
    '@fontsource/raleway/400.css',
    '@fontsource/raleway/500.css',
    '@fontsource/raleway/600.css',
    '@fontsource/raleway/700.css',
    '@fontsource/raleway/800.css',
    '~/assets/css/main.css',
  ],
  router: {
    // hash alapú útvonalak: bármely statikus tárhelyen (Cloudflare Pages) újratöltéskor is működik
    options: { hashMode: true },
  },
  app: {
    head: {
      title: 'Molio',
      htmlAttrs: { lang: 'hu' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Molio – fogorvosi rendelőkezelő program (bemutató verzió)' },
        { name: 'theme-color', content: '#3fa463' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Molio' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      appName: 'Molio',
      // 'browser' = nyilvános demó (IndexedDB), 'api' = végleges rendszer (Nitro REST + PostgreSQL)
      dataSource: 'browser',
    },
  },
  hooks: {
    // a felhasználói kézikönyv PDF minden buildnél újra elkészül a docs/kezikonyv.md-ből (spec v2.0, 2.10)
    'build:before': async () => {
      const { buildManual } = await import('./scripts/build-manual.mjs')
      await buildManual()
    },
  },
  nitro: {
    // statikus kimenet (Cloudflare buildkörnyezetben is): ne szerver-függvényt építsen
    preset: 'static',
    prerender: { routes: ['/'] },
  },
  pwa: {
    registerType: 'prompt',
    manifest: {
      name: 'Molio – fogorvosi rendelőkezelő',
      short_name: 'Molio',
      description: 'Fogorvosi rendelőkezelő program diktálással (bemutató verzió)',
      lang: 'hu',
      theme_color: '#3fa463',
      background_color: '#f4f6f7',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    generateSW: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      cleanupOutdatedCaches: true,
    },
    // 5 percenként és az alkalmazás előtérbe kerülésekor új verziót keres (a layout magától frissít, ha nincs folyamatban lévő munka)
    client: { installPrompt: false, periodicSyncForUpdates: 300 },
    devOptions: { enabled: false },
  },
})
