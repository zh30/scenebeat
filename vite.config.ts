/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
import { MANIFEST } from './src/pwa/manifest.ts';

export default defineConfig({
  // Relative base: one build works at `/` and under any sub-path.
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      // MANIFEST's local types are wider than the plugin's literal unions
      // (e.g. display_override: string[], dir includes 'auto'); values match the design.
      manifest: MANIFEST as Partial<ManifestOptions>,
      includeManifestIcons: true,
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
