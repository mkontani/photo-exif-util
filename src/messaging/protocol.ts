import { z } from 'zod';

/**
 * Background SW と Side Panel / Content Script 間のメッセージスキーマ。
 * zod で定義することで、受信側で安全にバリデーションできる。
 */

/**
 * メッセージング層で許可される URL スキーマ。
 * `z.string().url()` は実装によっては `javascript:` を通過させるため、
 * `refine` で http/https のみに制限する (XSS / SSRF 対策)。
 */
const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (val) => {
      try {
        const u = new URL(val);
        return u.protocol === 'https:' || u.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'Only http/https URLs are allowed' },
  );

/** URL から画像を取り込む要求 */
export const ingestRequestSchema = z.object({
  type: z.literal('INGEST_REQUEST'),
  payload: z.union([
    z.object({
      kind: z.literal('url'),
      url: httpUrlSchema,
    }),
    z.object({
      kind: z.literal('context-menu'),
      // pageUrl は context (例: chrome://newtab、空文字、chrome-extension://) を含み得る
      // 任意の文字列を許容する。SSRF 対策が必要な fetch には使わない参考情報フィールド。
      pageUrl: z.string(),
      srcUrl: httpUrlSchema,
    }),
  ]),
});

/**
 * Bridge 経由で許可される MIME タイプ。
 * Phase 4 の magic bytes 検証で扱う 3 種に揃え、他は INVALID_RESPONSE 扱い。
 * `<img src>` 経由の XSS や予期せぬ Blob 解釈を防ぐ。
 */
const allowedMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

/**
 * base64 文字列の最大長 (chrome.runtime.sendMessage の安全上限から逆算)。
 * 50MB raw → ~67MB base64 + JSON オーバーヘッドが MV3 メッセージング上限に近いので、
 * 70MB をハードキャップに設定。Phase 7 で Transferable に移行予定。
 */
const MAX_DATA_BASE64_LENGTH = 70 * 1024 * 1024;

/** 取り込み要求への応答 */
export const ingestResponseSchema = z.object({
  type: z.literal('INGEST_RESPONSE'),
  ok: z.boolean(),
  /**
   * 成功時に Blob を base64 で返す (Phase 6 で追加)。
   * Background SW → Side Panel の Blob 転送経路。
   */
  payload: z
    .object({
      dataBase64: z.string().max(MAX_DATA_BASE64_LENGTH),
      mimeType: allowedMimeTypeSchema,
      sizeBytes: z.number().int().nonnegative(),
    })
    .optional(),
  /**
   * エラー詳細を構造化して返す (Phase 6 で string から object に変更)。
   */
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

/** Side Panel を開く要求 */
export const openPanelSchema = z.object({
  type: z.literal('OPEN_PANEL'),
  payload: z.object({
    srcUrl: httpUrlSchema,
    pageUrl: httpUrlSchema,
  }),
});

/**
 * 全メッセージの判別共用体スキーマ。
 * 受信側で messageSchema.parse(msg) することで型安全にハンドリングできる。
 */
export const messageSchema = z.discriminatedUnion('type', [
  ingestRequestSchema,
  ingestResponseSchema,
  openPanelSchema,
]);

export type Message = z.infer<typeof messageSchema>;
export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type IngestResponse = z.infer<typeof ingestResponseSchema>;
export type OpenPanel = z.infer<typeof openPanelSchema>;

/**
 * chrome.runtime.MessageSender の ID が期待する拡張 ID と一致するか検証する。
 * 不正な拡張やウェブページからのメッセージを拒否するために使用する。
 *
 * @param senderId chrome.runtime.MessageSender.id (undefined の場合は外部送信元)
 * @param expectedId chrome.runtime.id (自拡張の ID)
 */
export function isExtensionSender(senderId: string | undefined, expectedId: string): boolean {
  return senderId === expectedId;
}
