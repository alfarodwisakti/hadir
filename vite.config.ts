import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const prsni = process.env.GITHUB_REPOSITORY?.split('/').pop();

export default defineConfig(() => {
  return {
    // Gunakan path relatif agar aman untuk Netlify, custom domain, dan GitHub Pages project site.
    // Jika dipublish ke repo GitHub Pages, otomatis dibuat: /<repo-name>/
    base: prsni ? `/${prsni}/` : './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Mengarahkan alias '@' ke direktori proyek utama
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR dikonfigurasi otomatis untuk lingkungan pengembangan
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
