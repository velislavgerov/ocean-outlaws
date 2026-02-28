import { defineConfig } from 'vite';

export default defineConfig({
  root: './game',
  base: './',
  optimizeDeps: {
    // Keep bootstrap focused on the new entrypoint while legacy files coexist.
    entries: ['index.html'],
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 1234,
    open: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
