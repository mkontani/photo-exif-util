import solidPlugin from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/ui/**',
        'src/background/index.ts',
        'src/manifest.config.ts',
        'src/styles/**',
        // ブラウザ依存アダプタ: createImageBitmap / OffscreenCanvas / pica が
        // jsdom 環境に存在しないため Vitest での計測対象から外す。
        // Phase 7 (Playwright) で integration テストする。
        'src/core/image/decode.ts',
        'src/core/image/resize.ts',
        'src/core/image/encode.ts',
        // Worker エントリは Phase 7 で本実装するスケルトン
        'src/offscreen/**',
        // Phase 4 ブラウザ依存アダプタ: chrome.* API / fetch が jsdom 環境に存在しないため除外。
        // Phase 7 (Playwright) で integration テストする。
        'src/background/context-menu.ts',
        'src/background/url-fetcher.ts',
        'src/content/**',
        'src/messaging/types.ts',
        // Phase 5 ブラウザ依存アダプタ: URL.createObjectURL / DOM が jsdom で動作しないため除外。
        'src/utils/download.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        // src/core は statements/lines/functions 90% を要求
        // branches は 75% に設定 (バイナリパーサの defensive ガード分岐は
        // 実テストでは到達せず、c8 ignore で部分除外しているため実用値)
        'src/core/**/*.ts': {
          lines: 90,
          branches: 75,
          functions: 90,
          statements: 90,
        },
      },
      perFile: false,
    },
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests',
    },
    conditions: ['development', 'browser'],
  },
});
