import { isExtensionSender, messageSchema } from '@/messaging/protocol';
/**
 * Chrome Extension Service Worker (Background SW)。
 * Phase 6: INGEST_REQUEST で fetchImageUrl を呼び、Blob を base64 で Side Panel に返す。
 * chrome.commands で open-side-panel コマンドも処理する。
 *
 * chrome.* 依存のため coverage exclude 対象。
 */
import { arrayBufferToBase64 } from '@/utils/base64';
import { createContextMenuEntry, registerContextMenuListener } from './context-menu';
import { fetchImageUrl } from './url-fetcher';

/**
 * messaging 経由で送れる Blob サイズの安全上限。
 * chrome.runtime.sendMessage は ~64MB ソフト上限。base64 化で ~33% 増えるため
 * 安全側で 45MB を raw 上限とする (45MB × 1.33 ≒ 60MB < 64MB)。
 */
const MAX_MESSAGING_BLOB_BYTES = 45 * 1024 * 1024;

/** 許可 MIME (protocol.ts と整合させる) */
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Blob を取得して INGEST_RESPONSE 形式の payload を返す共通関数 */
async function fetchAndEncode(
  url: string,
): Promise<
  | { ok: true; payload: { dataBase64: string; mimeType: string; sizeBytes: number } }
  | { ok: false; error: { code: string; message: string } }
> {
  const blob = await fetchImageUrl(url);
  if (blob.size > MAX_MESSAGING_BLOB_BYTES) {
    return {
      ok: false,
      error: {
        code: 'TOO_LARGE',
        message: `Blob too large for messaging (${blob.size} > ${MAX_MESSAGING_BLOB_BYTES})`,
      },
    };
  }
  const mimeType = ALLOWED_MIMES.has(blob.type) ? blob.type : 'image/jpeg';
  const arrayBuffer = await blob.arrayBuffer();
  const dataBase64 = arrayBufferToBase64(arrayBuffer);
  return { ok: true, payload: { dataBase64, mimeType, sizeBytes: blob.size } };
}

// 重要: addListener はトップレベルで同期的に呼ばないと、SW がアイドル停止後に
// イベントで再起動した際にリスナーが復活せずイベントが失われる (MV3 制約)。
// onInstalled は再起動時に再発火しないため、その中で addListener してはならない。
registerContextMenuListener();

chrome.runtime.onInstalled.addListener(() => {
  createContextMenuEntry();
});

// Ctrl+Shift+E (mac: Cmd+Shift+E) でサイドパネルを開くコマンド
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id !== undefined) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
          // user gesture なしでは失敗する場合があるため無視する
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    // 送信元が自拡張でなければ拒否する (外部サイトやスクリプトからの不正メッセージを防ぐ)
    if (!isExtensionSender(sender.id, chrome.runtime.id)) {
      sendResponse({
        type: 'INGEST_RESPONSE',
        ok: false,
        error: { code: 'UNTRUSTED_SENDER', message: 'untrusted sender' },
      });
      return false;
    }

    // メッセージスキーマの検証
    const parseResult = messageSchema.safeParse(message);
    if (!parseResult.success) {
      sendResponse({
        type: 'INGEST_RESPONSE',
        ok: false,
        error: { code: 'INVALID_MESSAGE', message: 'invalid message format' },
      });
      return false;
    }

    const msg = parseResult.data;

    if (msg.type === 'INGEST_REQUEST') {
      // 非同期処理のため return true で sendResponse を遅延させる
      (async () => {
        try {
          // exhaustive switch: 将来 payload.kind が増えても網羅性検査でビルドエラーになる
          switch (msg.payload.kind) {
            case 'url': {
              const result = await fetchAndEncode(msg.payload.url);
              sendResponse({ type: 'INGEST_RESPONSE', ...result });
              break;
            }
            case 'context-menu': {
              const result = await fetchAndEncode(msg.payload.srcUrl);
              sendResponse({ type: 'INGEST_RESPONSE', ...result });
              break;
            }
            default: {
              const _exhaustive: never = msg.payload;
              void _exhaustive;
              sendResponse({
                type: 'INGEST_RESPONSE',
                ok: false,
                error: { code: 'UNHANDLED_KIND', message: 'unhandled payload kind' },
              });
            }
          }
        } catch (cause) {
          const code =
            cause !== null &&
            typeof cause === 'object' &&
            'code' in cause &&
            typeof (cause as Record<string, unknown>).code === 'string'
              ? ((cause as Record<string, unknown>).code as string)
              : 'BACKGROUND_ERROR';
          const errorMessage = cause instanceof Error ? cause.message : 'background error';
          sendResponse({
            type: 'INGEST_RESPONSE',
            ok: false,
            error: { code, message: errorMessage },
          });
        }
      })();
      return true; // sendResponse を非同期で呼ぶため true を返す
    }

    return false;
  },
);
