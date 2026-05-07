import type { StripOptions } from '@/core/exif/strip';

/**
 * ICC プロファイルチャンク (PNG iCCP / WebP ICCP) を保持すべきか判定する。
 *
 * - keep 指定がある場合: keep に 'icc' が含まれていれば保持
 * - remove: 'all' の場合: 削除
 * - remove: [...] の場合: 'icc' が含まれていれば削除、含まれていなければ保持
 * - 未指定 (デフォルト): デフォルトでは ICC は保持しない (全削除)
 */
export function shouldKeepIcc(remove: StripOptions['remove'], keep: StripOptions['keep']): boolean {
  if (keep !== undefined) {
    return (keep as readonly string[]).includes('icc');
  }
  if (remove === 'all') {
    return false;
  }
  if (remove !== undefined) {
    return !(remove as readonly string[]).includes('icc');
  }
  return false;
}
