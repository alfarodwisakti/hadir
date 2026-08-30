import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const repoName = process.env.GITHUB_REPOSITORY?.split('/').pop();
const appBase = repoName ? `/${repoName}/` : '/';

export default defineConfig(() => {
  return {
    // Gunakan base URL yang konsisten untuk root domain dan GitHub Pages.
    // Jika dipublish ke project site GitHub Pages, otomatis dibuat: /<repo-name>/
    base: appBase,
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
