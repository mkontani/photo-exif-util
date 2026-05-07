/**
 * エラーコードを UI 表示用の構造化情報に変換する純粋関数。
 *
 * 旧来の「エラー: <内部メッセージ>」表示では、画像が壊れているのか
 * ネットワークが原因なのかをユーザーが判別できなかった。code に応じた
 * タイトル / 原因 / 対処法 の 3 点セットを i18n キーとして返すことで、
 * UI 側で `t()` ヘルパ経由でロケール別メッセージを表示する。
 */

/** エラーの severity (UI 上のスタイリング判定に使う) */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/** UI 表示用の構造化エラー情報 */
export interface ErrorDisplay {
  readonly titleKey: string;
  readonly descriptionKey: string;
  /** 対処方法のヒント (任意) */
  readonly hintKey?: string;
  readonly severity: ErrorSeverity;
}

/** 既知エラーコード → 表示情報のマッピング */
const ERROR_DISPLAY_MAP: Readonly<Record<string, ErrorDisplay>> = {
  // === 入力エラー ===
  EMPTY_INPUT: {
    titleKey: 'errui_empty_input_title',
    descriptionKey: 'errui_empty_input_desc',
    hintKey: 'errui_empty_input_hint',
    severity: 'warning',
  },
  TOO_LARGE: {
    titleKey: 'errui_too_large_title',
    descriptionKey: 'errui_too_large_desc',
    hintKey: 'errui_too_large_hint',
    severity: 'warning',
  },
  INVALID_FORMAT: {
    titleKey: 'errui_invalid_format_title',
    descriptionKey: 'errui_invalid_format_desc',
    hintKey: 'errui_invalid_format_hint',
    severity: 'warning',
  },
  PARSE_ERROR: {
    titleKey: 'errui_parse_error_title',
    descriptionKey: 'errui_parse_error_desc',
    hintKey: 'errui_parse_error_hint',
    severity: 'error',
  },

  // === URL エラー ===
  INVALID_URL: {
    titleKey: 'errui_invalid_url_title',
    descriptionKey: 'errui_invalid_url_desc',
    hintKey: 'errui_invalid_url_hint',
    severity: 'warning',
  },
  BLOCKED_URL: {
    titleKey: 'errui_blocked_url_title',
    descriptionKey: 'errui_blocked_url_desc',
    hintKey: 'errui_blocked_url_hint',
    severity: 'error',
  },
  FETCH_FAILED: {
    titleKey: 'errui_fetch_failed_title',
    descriptionKey: 'errui_fetch_failed_desc',
    hintKey: 'errui_fetch_failed_hint',
    severity: 'error',
  },
  CORS_BLOCKED: {
    titleKey: 'errui_cors_blocked_title',
    descriptionKey: 'errui_cors_blocked_desc',
    hintKey: 'errui_cors_blocked_hint',
    severity: 'error',
  },
  PERMISSION_DENIED: {
    titleKey: 'errui_permission_denied_title',
    descriptionKey: 'errui_permission_denied_desc',
    severity: 'warning',
  },

  // === 画像処理エラー ===
  STRIP_ERROR: {
    titleKey: 'errui_strip_error_title',
    descriptionKey: 'errui_strip_error_desc',
    severity: 'error',
  },
  DECODE_FAILED: {
    titleKey: 'errui_decode_failed_title',
    descriptionKey: 'errui_decode_failed_desc',
    severity: 'error',
  },
  RESIZE_FAILED: {
    titleKey: 'errui_resize_failed_title',
    descriptionKey: 'errui_resize_failed_desc',
    severity: 'error',
  },
  ENCODE_FAILED: {
    titleKey: 'errui_encode_failed_title',
    descriptionKey: 'errui_encode_failed_desc',
    severity: 'error',
  },
  SIZE_TARGET_UNREACHABLE: {
    titleKey: 'errui_size_target_unreachable_title',
    descriptionKey: 'errui_size_target_unreachable_desc',
    severity: 'warning',
  },
  INVALID_PROFILE: {
    titleKey: 'errui_invalid_profile_title',
    descriptionKey: 'errui_invalid_profile_desc',
    severity: 'error',
  },

  // === 通信 / Bridge エラー ===
  BRIDGE_ERROR: {
    titleKey: 'errui_bridge_error_title',
    descriptionKey: 'errui_bridge_error_desc',
    severity: 'error',
  },
  INVALID_RESPONSE: {
    titleKey: 'errui_invalid_response_title',
    descriptionKey: 'errui_invalid_response_desc',
    severity: 'error',
  },
};

/**
 * 既知のエラーコードに該当する表示情報を返す。
 * 未知の code は汎用的な「予期せぬエラー」として表示する。
 */
export function getErrorDisplay(code: string): ErrorDisplay {
  return (
    ERROR_DISPLAY_MAP[code] ?? {
      titleKey: 'errui_unknown_title',
      descriptionKey: 'errui_unknown_desc',
      severity: 'error',
    }
  );
}

/** 全 ErrorDisplay 定義の i18n キー一覧 (テスト用 / 翻訳ファイル整合性チェック用) */
export function listErrorDisplayKeys(): readonly string[] {
  const keys = new Set<string>();
  for (const display of Object.values(ERROR_DISPLAY_MAP)) {
    keys.add(display.titleKey);
    keys.add(display.descriptionKey);
    if (display.hintKey) keys.add(display.hintKey);
  }
  // 未知コード用の fallback キーも含める
  keys.add('errui_unknown_title');
  keys.add('errui_unknown_desc');
  return [...keys].sort();
}
