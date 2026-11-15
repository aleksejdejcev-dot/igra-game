import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: env.VITE_BASE || '/',
    build: { rollupOptions: { input: { main: 'index.html', dev: 'dev.html' } } },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
