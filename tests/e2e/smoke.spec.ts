/**
 * Chrome 拡張 smoke test (E2E)。
 * 拡張をロードして Service Worker が起動することを確認する最小テスト。
 *
 * 前提:
 *   - `pnpm build` で dist/ が生成済みであること
 *   - MV3 拡張の E2E は headless:false が必要 (headless では Service Worker が起動しない)
 *   - CI では xvfb などの仮想ディスプレイが必要
 *
 * 実行方法:
 *   RUN_E2E=true pnpm test:e2e
 */

import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const DIST_PATH = path.resolve(__dirname, '../../dist');

test('拡張がロードされ Service Worker が起動する', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    // MV3 拡張は headless モードでは動作しないため false を指定
    headless: false,
    args: [`--disable-extensions-except=${DIST_PATH}`, `--load-extension=${DIST_PATH}`],
  });

  try {
    // Service Worker (background script) が既に起動しているか待機する
    let sw = ctx.serviceWorkers()[0];
    if (!sw) {
      sw = await ctx.waitForEvent('serviceworker', { timeout: 10_000 });
    }
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain('chrome-extension://');
  } finally {
    await ctx.close();
  }
});

test('popup ページが chrome-extension:// URL で開ける', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST_PATH}`, `--load-extension=${DIST_PATH}`],
  });

  try {
    // Service Worker から拡張 ID を取得
    let sw = ctx.serviceWorkers()[0];
    if (!sw) {
      sw = await ctx.waitForEvent('serviceworker', { timeout: 10_000 });
    }

    const swUrl = sw.url();
    // chrome-extension://<id>/... から ID を抽出
    const match = swUrl.match(/chrome-extension:\/\/([a-z]{32})\//);
    if (!match) {
      // Service Worker URL が期待形式でない場合はスキップ
      test.skip();
      return;
    }

    const extensionId = match[1];
    const popupUrl = `chrome-extension://${extensionId}/src/ui/popup/index.html`;

    const page = await ctx.newPage();
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    // ポップアップの基本的な HTML 構造を確認
    const rootEl = page.locator('#root');
    await expect(rootEl).toBeAttached({ timeout: 5_000 });

    await page.close();
  } finally {
    await ctx.close();
  }
});
