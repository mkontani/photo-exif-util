/**
 * EXIF strip 公開 API。
 * フォーマットを自動判定して適切な strip エンジンに振り分ける。
 */
import { detectImageFormat } from '@/utils/detect-format';
import { MAX_BLOB_SIZE_BYTES } from './parse';
import { stripJpeg } from './strip-jpeg';
import { stripPng } from './strip-png';
import { stripWebp } from './strip-webp';
import type { ExifCategory, ImageFormat } from './types';

/**
 * strip で指定できるカテゴリ。ExifCategory に ICC プロファイルを追加した拡張型。
 * `icc` は JPEG では APP2、PNG では iCCP、WebP では ICCP チャンクに対応する。
 */
export type StripCategory = ExifCategory | 'icc';

export interface StripOptions {
  /**
   * 削除するカテゴリ。'all' で全削除。
   * `keep` と同時指定不可。
   */
  readonly remove?: readonly StripCategory[] | 'all';
  /**
   * 保持するカテゴリ (指定以外を全削除)。
   * `remove` と同時指定不可。
   * デフォルト動作では ICC プロファイルは保持される。
   */
  readonly keep?: readonly StripCategory[];
}

export interface StripResult {
  readonly blob: Blob;
  /** 削除したフィールドキー一覧 (検証/UI 用) */
  readonly removedKeys: readonly string[];
  readonly format: ImageFormat;
}

export type StripError =
  | { readonly code: 'UNSUPPORTED_FORMAT'; readonly message: string; readonly format: ImageFormat }
  | { readonly code: 'STRIP_ERROR'; readonly message: string }
  | { readonly code: 'INVALID_OPTIONS'; readonly message: string };

/**
 * 画像から EXIF メタデータを削除する。フォーマットは自動判定。
 *
 * デフォルト動作 (options 未指定 または remove: 'all'):
 * - 全 EXIF メタデータを削除する
 *
 * @throws StripError (rejected Promise)
 */
export async function stripExif(blob: Blob, options?: StripOptions): Promise<StripResult> {
  // 空入力チェック
  if (blob.size === 0) {
    const err: StripError = {
      code: 'STRIP_ERROR',
      message: 'Input blob is empty',
    };
    return Promise.reject(err);
  }

  // サイズ上限チェック (parse.ts と同じ上限値を再利用)
  if (blob.size > MAX_BLOB_SIZE_BYTES) {
    const err: StripError = {
      code: 'STRIP_ERROR',
      message: `Input blob exceeds maximum size: ${blob.size} > ${MAX_BLOB_SIZE_BYTES} bytes`,
    };
    return Promise.reject(err);
  }

  // オプション検証: remove と keep の同時指定は不可
  if (options?.remove !== undefined && options?.keep !== undefined) {
    const err: StripError = {
      code: 'INVALID_OPTIONS',
      message: '`remove` and `keep` cannot be specified simultaneously',
    };
    return Promise.reject(err);
  }

  // フォーマット判定
  const format = await detectImageFormat(blob);

  // デフォルト動作: options 未指定の場合は全削除
  const effectiveOptions: StripOptions = options ?? { remove: 'all' };

  try {
    switch (format) {
      case 'jpeg':
        return await stripJpeg(blob, effectiveOptions);
      case 'png':
        return await stripPng(blob, effectiveOptions);
      case 'webp':
        return await stripWebp(blob, effectiveOptions);
      case 'unknown': {
        const err: StripError = {
          code: 'UNSUPPORTED_FORMAT',
          message: 'Unsupported image format',
          format: 'unknown',
        };
        return Promise.reject(err);
      }
    }
  } catch (cause) {
    // 既に StripError として reject されている場合はそのまま再 throw
    if (isStripError(cause)) {
      return Promise.reject(cause);
    }
    const err: StripError = {
      code: 'STRIP_ERROR',
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return Promise.reject(err);
  }
}

/** 値が StripError 型かどうかを判定する型ガード */
function isStripError(value: unknown): value is StripError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    ['UNSUPPORTED_FORMAT', 'STRIP_ERROR', 'INVALID_OPTIONS'].includes(
      (value as Record<string, unknown>).code as string,
    )
  );
}
