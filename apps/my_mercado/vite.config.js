import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const normalizeBase = (value) => {
    if (!value) return undefined;
    let base = value.trim();
    if (!base) return undefined;
    if (!base.startsWith('/')) base = `/${base}`;
    if (!base.endsWith('/')) base += '/';
    return base;
  };

  const baseOverride = normalizeBase(env.VITE_BASE_URL);
  const githubRepo = process.env.GITHUB_REPOSITORY?.split('/')[1];

  const isGitHubPagesBuild =
    process.env.GITHUB_ACTIONS === 'true' &&
    Boolean(githubRepo) &&
    !githubRepo.endsWith('.github.io');

  const base = baseOverride ?? (isGitHubPagesBuild ? `/${githubRepo}/` : '/');

  const useBasicSsl = env.VITE_BASIC_SSL === 'true';
  const sslCertPath = env.VITE_SSL_CERT_PATH;
  const sslKeyPath = env.VITE_SSL_KEY_PATH;

  let https = false;

  if (sslCertPath && sslKeyPath) {
    https = {
      cert: fs.readFileSync(path.resolve(sslCertPath)),
      key: fs.readFileSync(path.resolve(sslKeyPath)),
    };
  } else if (useBasicSsl) {
    https = true;
  }

  return {
    base,

    plugins: [
      react(),
      useBasicSsl ? basicSsl() : null,

      VitePWA({
        registerType: 'autoUpdate',

        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          cacheId: 'my-mercado-cache-v2', // Força novo cache

          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

          runtimeCaching: [
            // ✅ Navegação (HTML)
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-v2',
              }
            },

            // ✅ JS e CSS
            {
              urlPattern: ({ request }) =>
                request.destination === 'script' ||
                request.destination === 'style',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'assets-v2',
              }
            },

            // ✅ Imagens
            {
              urlPattern: ({ request }) =>
                request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images-v2',
              }
            }
          ]
        },

        manifest: {
          name: 'My Mercado',
          short_name: 'Mercado',
          description: 'Acompanhe preços e economize com inteligência artificial.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            }
          ]
        }
      })

    ].filter(Boolean),

    define: {
      global: 'globalThis',
    },

    optimizeDeps: {
      exclude: ['@supabase/supabase-js']
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('scheduler') ||
                id.includes('prop-types')
              ) {
                return 'vendor-framework';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-ui';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'vendor-query';
              }
              if (id.includes('react-window')) {
                return 'vendor-virtual';
              }
              if (id.includes('@zxing/library')) {
                return 'vendor-scanner';
              }
            }
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },

    server: {
      host: true,
      https,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },

    preview: {
      port: 4173,
      host: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },
  };
});