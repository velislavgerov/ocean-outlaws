import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ocean-outlaws/game/',
  root: './game',
  publicDir: '../static',
  build: {
    outDir: '../dist/game',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: { rapier: ['@dimforge/rapier3d-simd-compat'] }
      }
    }
  },
  server: {
    port: 1234,
    open: true
  }
});
