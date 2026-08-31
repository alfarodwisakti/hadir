import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const repoName = 'hadir';
const appBase = repoName ? `/${repoName}/` : '/';

export default defineConfig(() => {
  return {
    // GitHub Pages project site harus memakai /hadir/.
    // Saat local dev, gunakan '/' untuk tetap bisa dijalankan di http://localhost:3000.
    base: appBase,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});