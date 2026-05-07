import type { ImageFormat } from '@/core/exif/types';
import { detectImageFormat } from '@/utils/detect-format';

/** マジックバイト検証の結果 */
export interface MagicBytesValidation {
  readonly detected: ImageFormat;
  readonly accepted: boolean;
}

/**
 * Blob の先頭バイトでフォーマットを判定し、許可リストに含まれるか確認する。
 * Blob.type (MIME タイプ文字列) は偽装可能なため信用せず、
 * Phase 1 の detectImageFormat を使ってマジックバイトで判定する。
 *
 * @param blob 検証対象の Blob
 * @param allowedFormats 許可フォーマットリスト (未指定時は ['jpeg','png','webp'])
 */
export async function validateMagicBytes(
  blob: Blob,
  allowedFormats?: readonly ImageFormat[],
): Promise<MagicBytesValidation> {
  // 未指定の場合は拡張がサポートする全フォーマットを許可
  const allowed = allowedFormats ?? (['jpeg', 'png', 'webp'] as const);

  const detected = await detectImageFormat(blob);
  const accepted = detected !== 'unknown' && (allowed as readonly string[]).includes(detected);

  return { detected, accepted };
}
