export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],
  app: {
    head: {
      title: 'Molio',
      htmlAttrs: { lang: 'hu' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0ea5e9' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Molio' }
      ]
    }
  },
  runtimeConfig: {
    // csak szerveroldalon elérhető (.env: NUXT_DATABASE_URL helyett a Prisma a DATABASE_URL-t használja)
    public: {
      appName: 'Molio'
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Molio',
      short_name: 'Molio',
      description: 'Fogorvosi gyakorlat-támogató szoftver',
      lang: 'hu',
      theme_color: '#0ea5e9',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: []
    },
    workbox: { navigateFallback: '/' },
    devOptions: { enabled: false }
  }
})
