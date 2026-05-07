/**
 * Side Panel エントリポイント。
 * 起動時に chrome.storage.local から設定を読み、テーマを適用する。
 */
import { validateSettings } from '@/state/settings-store';
import { resolveTheme } from '@/state/theme-store';
import { render } from 'solid-js/web';
import { App } from './App';

/**
 * chrome.storage.local から設定を読み込み、data-theme 属性をセットする。
 * storage が使えない環境 (テスト、popup 等) では prefers-color-scheme CSS のみで動く。
 */
async function applyThemeFromStorage(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    const raw = await chrome.storage.local.get('settings');
    const settings = validateSettings(raw.settings);
    const prefersDark =
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = resolveTheme(settings.theme, prefersDark);

    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolved;
    }
  } catch {
    // storage アクセス失敗時は CSS の prefers-color-scheme に委ねる
  }
}

// テーマを適用してからアプリをレンダリングする
applyThemeFromStorage().finally(() => {
  const root = document.getElementById('root');
  if (root) {
    render(() => <App />, root);
  }
});
