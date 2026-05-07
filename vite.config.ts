import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import manifest from './src/manifest.config';

export default defineConfig(({ mode }) => ({
  plugins: [solidPlugin(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests',
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    // production ビルドではソースマップを出力しない (リバースエンジニアリング対策)
    sourcemap: mode !== 'production',
    rollupOptions: {
      input: {
        popup: 'src/ui/popup/index.html',
        'side-panel': 'src/ui/side-panel/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
}));
