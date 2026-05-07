import { MAX_BLOB_SIZE_BYTES } from '@/core/exif/parse';
import type { ImageFormat } from '@/core/exif/types';
import { validateMagicBytes } from './magic-bytes';

/** ファイルバリデーション結果 */
export type FileValidationResult =
  | { readonly ok: true; readonly blob: Blob; readonly detected: ImageFormat }
  | {
      readonly ok: false;
      readonly code: 'TOO_LARGE' | 'EMPTY_INPUT' | 'INVALID_FORMAT';
      readonly message: string;
    };

/**
 * File または Blob をバリデーションして安全な Blob を返す純粋関数。
 *
 * チェック順序:
 *   1. 空ファイル → EMPTY_INPUT
 *   2. サイズ超過 → TOO_LARGE
 *   3. マジックバイト不正 → INVALID_FORMAT
 */
export async function validateFile(file: File | Blob): Promise<FileValidationResult> {
  // 空ファイルチェック (最優先)
  if (file.size === 0) {
    return { ok: false, code: 'EMPTY_INPUT', message: 'File is empty' };
  }

  // サイズ上限チェック (fetch 前の入口でも確認)
  if (file.size > MAX_BLOB_SIZE_BYTES) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      message: `File size ${file.size} bytes exceeds limit of ${MAX_BLOB_SIZE_BYTES} bytes`,
    };
  }

  // マジックバイト検証 (Blob.type を信用しない)
  const { detected, accepted } = await validateMagicBytes(file);
  if (!accepted) {
    return {
      ok: false,
      code: 'INVALID_FORMAT',
      message: `Invalid image format: detected "${detected}"`,
    };
  }

  return { ok: true, blob: file, detected };
}
