import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        includeAssets: [
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'offline.html',
          'manifest.webmanifest',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/assets\/aistudio/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /\/assets\/aistudio\/.*\.csv$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'edudirectory-seed-csv',
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: ({url}) =>
                url.hostname.endsWith('.supabase.co') &&
                (url.pathname.startsWith('/rest/v1/institutions') ||
                  url.pathname.startsWith('/rest/v1/education_offices')),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-institutions-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            {
              urlPattern: ({url}) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/auth/'),
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
