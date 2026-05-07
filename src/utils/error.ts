/**
 * unknown 型エラーから { code, message } を安全に抽出する。
 * StripError / IngestError / SnsApplyError / BridgeError など
 * rejected Promise で使われるすべての error 型に対応する。
 */

export interface ErrorInfo {
  readonly code: string;
  readonly message: string;
}

/**
 * code フィールドと message フィールドを持つ object かどうかを型ガードで確認する。
 */
function hasCodeAndMessage(val: object): val is { code: string; message: string } {
  return (
    'code' in val &&
    typeof (val as Record<string, unknown>).code === 'string' &&
    'message' in val &&
    typeof (val as Record<string, unknown>).message === 'string'
  );
}

/**
 * code フィールドのみを持つ object かどうかを型ガードで確認する。
 */
function hasCode(val: object): val is { code: string } {
  return 'code' in val && typeof (val as Record<string, unknown>).code === 'string';
}

/**
 * unknown 型のエラーから { code, message } を安全に抽出する。
 *
 * @param err 任意の値 (rejected Promise の reason など)
 * @param fallbackCode code が不明な場合のデフォルト値 (省略時は 'UNKNOWN_ERROR')
 */
export function extractErrorInfo(err: unknown, fallbackCode?: string): ErrorInfo {
  const code = fallbackCode ?? 'UNKNOWN_ERROR';

  // Error インスタンス: message を取り、code は fallbackCode を使う
  if (err instanceof Error) {
    return { code, message: err.message };
  }

  // object: code/message フィールドを検査する
  if (typeof err === 'object' && err !== null && !Array.isArray(err)) {
    if (hasCodeAndMessage(err)) {
      // code と message 両方ある → そのまま返す (fallbackCode は無視)
      return { code: err.code, message: err.message };
    }
    if (hasCode(err)) {
      // code だけある → message はフォールバック
      return { code: err.code, message: String(err) };
    }
    // 両方欠落 または code が非 string
    return { code, message: String(err) };
  }

  // プリミティブ / null / undefined / 配列
  return { code, message: String(err) };
}
