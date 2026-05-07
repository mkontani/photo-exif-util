import { validateUrl } from '@/core/ingest/url-validator';

/**
 * 右クリックメニューを登録し、画像の srcUrl を Side Panel に渡すハンドラを設定する。
 * ブラウザ API に依存するため coverage exclude 対象。Phase 7 で integration test を行う。
 *
 * 受け渡し方式:
 *   chrome.runtime.sendMessage は送信元と一致する context (background) には届かず、
 *   かつ chrome.sidePanel.open 直後は Side Panel がまだロードされていない競合状態がある。
 *   そのため chrome.storage.session に pendingIngest を書き込み、Side Panel が起動時 or
 *   onChanged で受信する方式を採用する。
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

    // 重要: sidePanel.open は user gesture コンテキスト内で「同期的に」呼ぶ必要がある。
    // await を先に挟むと user activation が失われて以下のエラーで失敗する:
    //   "sidePanel.open() may only be called in response to a user gesture"
    // そのため Promise を await せず、sidePanel.open を最優先で発火させる。
    if (tab?.id !== undefined) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
        // user gesture 不在 / Chrome 116 未満などの環境では無視する
      });
    }

    // pendingIngest を session storage に保存。
    // Side Panel 起動時の onMount + chrome.storage.onChanged の双方で受信できる。
    // sidePanel.open の後に Promise として発火させるが、await はしない (Promise 戻り値で
    // listener を async にすると user activation 検知が壊れる Chrome の挙動を回避)。
    chrome.storage.session
      .set({
        pendingIngest: {
          srcUrl: info.srcUrl,
          ts: Date.now(),
        },
      })
      .catch(() => {
        // storage 書き込み失敗時は無視 (Side Panel 起動後にユーザーが手動で URL 入力可能)
      });
  });
}
