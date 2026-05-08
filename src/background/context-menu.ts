import { validateUrl } from '@/core/ingest/url-validator';

/**
 * 右クリックメニュー関連のセットアップ。ブラウザ API に依存するため coverage exclude 対象。
 *
 * MV3 Service Worker のライフサイクル制約上、`addListener` 系は **トップレベル** で
 * 同期的に登録しなければならない。SW がアイドルで停止 → イベントで再起動するときは
 * トップレベルコードのみが再実行されるため、`onInstalled` の中でリスナーを登録すると
 * 2 回目以降の起動で listener が無くなりイベントが失われる。
 *
 * そのため:
 *   - `registerContextMenuListener()`: `onClicked` リスナー登録のみ。SW 起動毎にトップレベルで呼ぶ
 *   - `createContextMenuEntry()`: メニュー項目の登録 (重複作成不可)。`onInstalled` 内で 1 回だけ呼ぶ
 *
 * 受け渡し方式:
 *   `chrome.runtime.sendMessage` は送信元と一致する context (background) には届かず、
 *   かつ `chrome.sidePanel.open` 直後は Side Panel がまだロードされていない競合状態がある。
 *   そのため `chrome.storage.session` に pendingIngest を書き込み、Side Panel が起動時 or
 *   `onChanged` で受信する方式を採用する。
 */

export function registerContextMenuListener(): void {
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

export function createContextMenuEntry(): void {
  chrome.contextMenus.create({
    id: 'photo-exif-util-open',
    title: chrome.i18n.getMessage('contextMenuOpen') || 'Photo EXIF Util で開く',
    contexts: ['image'],
  });
}
