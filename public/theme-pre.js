/**
 * FOUC (Flash of Unstyled Content) 対策スクリプト。
 * chrome.storage.local は同期 API を持たないため、起動直後は
 * prefers-color-scheme でテーマを先行適用する。
 * main.tsx の applyThemeFromStorage が非同期完了後に上書きする。
 *
 * CSP 対策: inline script を避けるため外部ファイルとして提供する。
 */
(() => {
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }
  } catch (_e) {
    // Extension context で matchMedia が利用できない場合は何もしない
  }
})();
