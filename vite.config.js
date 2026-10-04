import { defineConfig } from 'vite';

// Проект-репозиторий на GitHub Pages живёт по адресу /universe/
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
