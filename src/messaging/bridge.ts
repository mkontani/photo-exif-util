/**
 * Side Panel ↔ Background SW メッセージブリッジ。
 *
 * chrome.runtime.sendMessage を DI パターンで抽象化することで、
 * テスト時に sender をモックして chrome.* 依存なしに動作確認できる。
 *
 * Phase 6: INGEST_REQUEST → INGEST_RESPONSE (payload.dataBase64) → Blob 復元まで実装完了。
 */
import { base64ToUint8Array } from '@/utils/base64';
import { ingestResponseSchema } from './protocol';
import type { Message } from './protocol';

/**
 * bridge 層のエラー型。
 * - INVALID_RESPONSE: スキーマ検証失敗、または null/undefined 応答
 * - BRIDGE_ERROR: sender の例外、または ok=false 応答
 */
export interface BridgeError {
  readonly code: 'INVALID_RESPONSE' | 'BRIDGE_ERROR';
  readonly message: string;
}

/**
 * メッセージ送信の抽象インターフェース。
 * 本番では chromeRuntimeSender、テストでは mock を渡す。
 */
export interface MessageSender {
  send: (message: Message) => Promise<unknown>;
}

/**
 * chrome.runtime.sendMessage を Promise として包む実装。
 * ブラウザ依存のため coverage 対象外。
 */
/* c8 ignore start */
export const chromeRuntimeSender: MessageSender = {
  send: (message: Message): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: unknown) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? 'chrome.runtime error'));
          return;
        }
        resolve(response);
      });
    });
  },
};
/* c8 ignore stop */

/**
 * INGEST_REQUEST を Background SW に送り、Blob を返す。
 *
 * ok=false なら BridgeError (BRIDGE_ERROR) として reject する。
 * 不正なレスポンスフォーマットなら INVALID_RESPONSE として reject する。
 * ok=true でも payload が欠落していれば INVALID_RESPONSE として reject する。
 * sender が throw したなら BRIDGE_ERROR として reject する。
 *
 * Phase 6: Background SW から base64 を受け取って Blob に復元して返す。
 */
export async function requestIngestUrl(url: string, sender: MessageSender): Promise<Blob> {
  let raw: unknown;

  try {
    raw = await sender.send({
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url },
    });
  } catch (cause) {
    const err: BridgeError = {
      code: 'BRIDGE_ERROR',
      message: cause instanceof Error ? cause.message : String(cause),
    };
    throw err;
  }

  // レスポンスが存在しない (undefined/null) か、スキーマ不正の場合
  if (raw === null || raw === undefined) {
    const err: BridgeError = {
      code: 'INVALID_RESPONSE',
      message: 'Received null or undefined response from Background SW',
    };
    throw err;
  }

  // ingestResponseSchema でバリデーション
  const parseResult = ingestResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    const err: BridgeError = {
      code: 'INVALID_RESPONSE',
      message: `Invalid response format: ${parseResult.error.message}`,
    };
    throw err;
  }

  const response = parseResult.data;

  // ok=false は Background SW がエラーを返したことを示す
  if (!response.ok) {
    const errMsg = response.error
      ? `${response.error.code}: ${response.error.message}`
      : 'Background SW returned ok=false';
    const err: BridgeError = {
      code: 'BRIDGE_ERROR',
      message: errMsg,
    };
    throw err;
  }

  // ok=true でも payload がなければ INVALID_RESPONSE
  if (!response.payload) {
    const err: BridgeError = {
      code: 'INVALID_RESPONSE',
      message: 'ok=true but payload is missing from response',
    };
    throw err;
  }

  // base64 → Uint8Array → Blob に復元する。
  // atob は不正 base64 で DOMException を throw するため、
  // INVALID_RESPONSE として正規化する (UI の error 分類を維持)。
  try {
    const bytes = base64ToUint8Array(response.payload.dataBase64);
    return new Blob([bytes], { type: response.payload.mimeType });
  } catch (cause) {
    const err: BridgeError = {
      code: 'INVALID_RESPONSE',
      message: `Failed to decode base64 payload: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
    throw err;
  }
}
