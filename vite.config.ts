import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Same path as the legacy worker (/sw.js) so the old "artrk-v9" SW is replaced in place.
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-180.png', 'icon-192.png', 'icon-512.png', 'fonts/*.woff2'],
      manifest: {
        name: 'دقيق — نظام حياتك',
        short_name: 'دقيق',
        description: 'تتبّع مهامك وعاداتك ودراستك وصحتك ومصاريفك في مكان واحد',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#101113',
        theme_color: '#101113',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Private records live in IndexedDB, never in the HTTP cache.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // math rendering is loaded on demand only
        globIgnores: ['**/katex*', '**/KaTeX_*', 'og-image.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // stable vendor chunks: app updates don't invalidate cached libraries
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react';
          if (/[\\/](@radix-ui|radix-ui|vaul|cmdk|@floating-ui|aria-hidden|react-remove-scroll)/.test(id)) return 'ui';
          if (/[\\/](dexie|dexie-react-hooks)[\\/]/.test(id)) return 'dexie';
          if (/[\\/](date-fns|rrule)[\\/]/.test(id)) return 'dates';
          if (/[\\/]lucide-react[\\/]/.test(id)) return 'icons';
          if (/[\\/](zod)[\\/]/.test(id)) return 'zod';
          if (/[\\/]@dnd-kit[\\/]/.test(id)) return 'dnd';
          return undefined;
        },
      },
    },
  },
});
