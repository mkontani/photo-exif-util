/**
 * chrome.i18n.getMessage のラッパ。
 * テスト環境では chrome が存在しないため、setI18nTestDict で
 * 辞書を直接注入してテスト可能にしている。
 *
 * 結果の優先順位:
 *   1. testDict が設定されていればそれを使う
 *   2. chrome.i18n.getMessage を呼ぶ
 *   3. 結果が空なら fallback
 *   4. fallback がなければ key をそのまま返す (デバッグ用)
 */

/** テスト時に注入する辞書 (null = chrome.i18n を使う) */
let testDict: Readonly<Record<string, string>> | null = null;

/**
 * テスト用辞書を設定する。
 * null を渡すと chrome.i18n モードに戻る。
 */
export function setI18nTestDict(dict: Readonly<Record<string, string>> | null): void {
  testDict = dict;
}

/**
 * i18n メッセージを取得する。
 *
 * @param key i18n キー
 * @param substitutions chrome.i18n と同じ置換変数配列
 * @param fallback chrome.i18n が空文字を返した場合のデフォルト
 */
export function t(key: string, substitutions?: readonly string[], fallback?: string): string {
  let message: string;

  if (testDict !== null) {
    // テスト辞書モード: substitutions を $N 形式で展開
    const raw = testDict[key];
    if (raw === undefined) {
      return fallback ?? key;
    }
    message = applySubstitutions(raw, substitutions);
  } else {
    // chrome.i18n モード
    // chrome が未定義 (jsdom 等) の場合は空文字として扱う
    try {
      const chromeSubs = substitutions ? [...substitutions] : undefined;
      message = chrome.i18n.getMessage(key, chromeSubs);
    } catch {
      message = '';
    }
  }

  // 空文字なら fallback → key の順で返す
  if (message === '') {
    return fallback ?? key;
  }
  return message;
}

/**
 * $1, $2, ... 形式のプレースホルダーを substitutions で置換する。
 * chrome.i18n 互換の簡易実装。
 */
function applySubstitutions(
  template: string,
  substitutions: readonly string[] | undefined,
): string {
  if (!substitutions || substitutions.length === 0) return template;

  return template.replace(/\$(\d+)/g, (_, indexStr: string) => {
    const index = Number(indexStr) - 1;
    return substitutions[index] ?? '';
  });
}
