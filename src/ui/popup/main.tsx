/**
 * ポップアップ UI。
 * Side Panel を開くボタンのみを提供する。
 * 本体機能は Side Panel で実装している。
 */
import { render } from 'solid-js/web';

function PopupApp() {
  function openSidePanel() {
    // Chrome 116+ の chrome.sidePanel API で Side Panel を開く
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id !== undefined) {
          // user gesture が必要な API のため失敗時は無視 (UnhandledRejection 防止)
          chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        }
      });
    }
  }

  return (
    <div class="flex min-w-[200px] flex-col gap-3 p-4">
      <h1 class="text-base font-bold">Photo EXIF Util</h1>
      <button
        type="button"
        onClick={openSidePanel}
        class="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        サイドパネルを開く
      </button>
      <p class="text-xs text-gray-500">EXIF の確認・削除はサイドパネルで行います。</p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  render(() => <PopupApp />, root);
}
