import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@client': fileURLToPath(new URL('./src/client', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat', '@recast-navigation/core', '@recast-navigation/generators', '@recast-navigation/wasm'],
  },
  server: { port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
