/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative base so the build works under any GitHub Pages repo path.
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      // The worker runtime's e2e harness ships beside the app; nothing links to it.
      input: { main: page('./index.html'), runtimeHarness: page('./harness/runtime.html') },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
