import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/finland-boater-map/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/**/*.png', 'favicon.ico'],
      manifest: {
        name: 'Finland Boater Map',
        short_name: 'Boater Map',
        description: 'Waterway restrictions and traffic signs for Finnish boaters',
        theme_color: '#0A4D68',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/aineistot\.vayla\.fi\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vayla-data',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ],
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        minifyInternalExports: false
      }
    }
  }
});
