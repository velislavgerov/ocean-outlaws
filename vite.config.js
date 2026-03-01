import { defineConfig } from 'vite';

function devGamePrefixRewritePlugin() {
  return {
    name: 'dev-game-prefix-rewrite',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url;
        if (!url) {
          next();
          return;
        }
        if (url === '/game' || url.startsWith('/game/')) {
          const rewritten = url.slice('/game'.length);
          req.url = rewritten || '/';
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  root: './game',
  // Serve at root in production with relative asset URLs for GH Pages project paths.
  base: command === 'build' ? './' : '/',
  plugins: [devGamePrefixRewritePlugin()],
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
}));
