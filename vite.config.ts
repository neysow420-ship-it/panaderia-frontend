import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El service worker nuevo se activa solo. Las ventas pendientes viven
      // en PouchDB (IndexedDB), así que una actualización no las pierde.
      registerType: 'autoUpdate',

      // Archivos de /public que también deben quedar disponibles sin conexión.
      includeAssets: ['favicon.svg'],

      manifest: {
        name: 'Panadería',
        short_name: 'Panadería',
        description: 'Sistema de gestión para panaderías',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#a6491f',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Solo el "shell": HTML, JS, CSS e imágenes generadas por el build.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],

        // Al reabrir sin red, cualquier navegación devuelve el index.html cacheado.
        navigateFallback: 'index.html',
        // Las rutas de la API nunca se reemplazan por el shell.
        navigateFallbackDenylist: [/^\/api\//],

        cleanupOutdatedCaches: true,

        // Vacío a propósito: no se cachea ninguna petición a la API ni a
        // CouchDB. Ni escrituras ni reportes pasan por el cache.
        runtimeCaching: [],
      },
    }),
  ],
  define: {
    global: 'window',
  },
})