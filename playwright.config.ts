import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Chrome 拡張の E2E テスト設定 (Phase 7 で実テスト追加)
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // 拡張を persistent context でロードする設定
        // Phase 7 で実際のパスに更新
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'dist')}`,
            `--load-extension=${path.resolve(__dirname, 'dist')}`,
          ],
        },
      },
    },
  ],
  // E2E テストは Phase 7 で本格的に追加する。それまでは tests/e2e/ が空でも
  // playwright が "0 tests found" でエラーにしないよう、空配列を testMatch に設定。
  testMatch: process.env.RUN_E2E ? ['**/*.spec.ts'] : [],
});
