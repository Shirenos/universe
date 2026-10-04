import { defineConfig } from 'vite';

// A GitHub Pages project repository is served from /universe/
export default defineConfig({
  base: '/universe/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
