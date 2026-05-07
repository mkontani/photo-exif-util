/**
 * ファイル名の安全化と衝突回避ユーティリティ。
 * UI から受け取ったファイル名や URL 由来のファイル名を
 * ダウンロード時に安全な形に変換するために使う。
 */

/**
 * 最後のドットで base と拡張子を分割する。
 * 先頭ドットのみ (隠しファイル: ".gitignore") は拡張子なしとして扱う。
 */
export function splitExtension(name: string): { readonly base: string; readonly ext: string } {
  // 空文字列は早期リターン
  if (name === '') return { base: '', ext: '' };

  const dotIndex = name.lastIndexOf('.');
  // ドットなし、または先頭ドットのみ (dotIndex === 0) は拡張子なし
  if (dotIndex <= 0) return { base: name, ext: '' };

  return { base: name.slice(0, dotIndex), ext: name.slice(dotIndex) };
}

/**
 * ファイル名をサニタイズする。
 * - パス区切り文字 (/ \ :) を '_' に置換
 * - 制御文字 (U+0000–U+001F, U+007F) を除去
 * - 先頭末尾の空白・ドットを trim
 * - 空文字になったら 'image' を返す
 */
export function safeFilename(input: string): string {
  // パス区切り文字を '_' に置換
  let result = input.replace(/[/\\:]/g, '_');

  // 制御文字を除去 (U+0000–U+001F, U+007F)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字そのものを除去するため必要
  result = result.replace(/[\x00-\x1F\x7F]/g, '');

  // 先頭末尾の空白・ドットを trim
  result = result.replace(/^[\s.]+|[\s.]+$/g, '');

  // 空文字になったらデフォルト名
  return result === '' ? 'image' : result;
}

/**
 * ファイル名衝突を回避する。
 * existing リスト中に同名があれば "base (N).ext" 形式でインクリメントする。
 *
 * 防御的上限: 9999 を超えた場合はタイムスタンプを付与してフォールバックする
 * (異常な existing リストでの無限ループ対策)
 */
export function uniqueFilename(desired: string, existing: readonly string[]): string {
  if (!existing.includes(desired)) return desired;

  const { base, ext } = splitExtension(desired);
  const MAX_COUNTER = 9999;

  for (let counter = 2; counter <= MAX_COUNTER; counter++) {
    const candidate = `${base} (${counter})${ext}`;
    if (!existing.includes(candidate)) return candidate;
  }
  // フォールバック: タイムスタンプを付与して衝突をほぼ不可能にする
  return `${base} (${Date.now()})${ext}`;
}
