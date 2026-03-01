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
  // Keep local dev at "/" while production builds target the GH Pages game route.
  base: command === 'build' ? '/game/' : '/',
  plugins: [devGamePrefixRewritePlugin()],
  optimizeDeps: {
    // Keep bootstrap focused on the new entrypoint while legacy files coexist.
    entries: ['index.html'],
  },
  build: {
    outDir: '../dist/game',
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
