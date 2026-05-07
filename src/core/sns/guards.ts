import type { SnsApplyError } from './types';

/** SnsApplyError.code として有効な値の集合 */
const SNS_APPLY_ERROR_CODES = new Set<string>([
  'DECODE_FAILED',
  'RESIZE_FAILED',
  'ENCODE_FAILED',
  'SIZE_TARGET_UNREACHABLE',
  'INVALID_PROFILE',
]);

/**
 * SnsApplyError の型ガード。
 * code フィールドがホワイトリストに含まれる文字列のみ true を返す。
 * apply.ts と resize.ts で共通利用する。
 */
export function isSnsApplyError(value: unknown): value is SnsApplyError {
  if (typeof value !== 'object' || value === null || !('code' in value)) return false;
  const code = (value as Record<string, unknown>).code;
  return typeof code === 'string' && SNS_APPLY_ERROR_CODES.has(code);
}
