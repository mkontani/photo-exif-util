import { validateUrl } from '@/core/ingest/url-validator';

/**
 * 右クリックメニューを登録し、画像の srcUrl を Side Panel に送るハンドラを設定する。
 * ブラウザ API に依存するため coverage exclude 対象。Phase 7 で integration test を行う。
 */
export function registerContextMenu(): void {
  chrome.contextMenus.create({
    id: 'photo-exif-util-open',
    title: chrome.i18n.getMessage('contextMenuOpen') || 'Photo EXIF Util で開く',
    contexts: ['image'],
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'photo-exif-util-open') return;
    if (info.srcUrl === undefined) return;

    // SSRF 対策: 右クリック経由の URL も同じバリデーションパスを通す。
    // メッセージング層 (httpUrlSchema) と整合させるため data:/blob: は拒否する
    const validation = validateUrl(info.srcUrl, { allowData: false, allowBlob: false });
    if (!validation.ok) return;

    if (tab?.id !== undefined) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
        // user gesture が必要な API のため、失敗時は無視する
      });
    }

    // Side Panel に取り込み要求を送信する (Phase 5 で受信側を実装)
    chrome.runtime
      .sendMessage({
        type: 'INGEST_REQUEST',
        payload: {
          kind: 'context-menu',
          pageUrl: tab?.url ?? '',
          srcUrl: info.srcUrl,
        },
      })
      .catch(() => {
        // Side Panel が開いていない場合は受信者なしエラーが発生するため無視する
      });
  });
}
