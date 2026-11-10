import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Two separate entry points -> two separate bundles:
//   /          -> index.html        (public resident portal; contains NO admin code)
//   /admin/    -> admin/index.html  (admin app; protected by login + database rules)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        public: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
});
