/**
 * SNS プロファイル適用パイプライン。
 * decode → resize → encode (品質サーチ) → strip の順で処理する。
 *
 * DI (依存性注入) パターンを採用し、ブラウザ依存部分をモック可能にする。
 * これにより jsdom 環境でもパイプライン全体をユニットテストできる。
 */
import type { StripCategory, StripOptions } from '@/core/exif/strip';
import { calculateOutputDimensions } from '@/core/image/dimensions';
import { searchQuality } from '@/core/image/quality-search';
import { isSnsApplyError } from './guards';
import type { OutputFormat, SnsApplyError, SnsApplyResult, SnsProfile } from './types';

/** 依存性注入インターフェース */
export interface SnsApplyDeps {
  /** Blob → ImageBitmap デコード */
  decode: (blob: Blob) => Promise<ImageBitmap>;
  /** ImageBitmap → OffscreenCanvas リサイズ */
  resize: (
    bitmap: ImageBitmap,
    target: { width: number; height: number; cropOffset?: { x: number; y: number } },
  ) => Promise<OffscreenCanvas>;
  /** OffscreenCanvas → Blob エンコード */
  encode: (canvas: OffscreenCanvas, format: OutputFormat, quality: number) => Promise<Blob>;
  /** EXIF strip */
  strip: (
    blob: Blob,
    options?: StripOptions,
  ) => Promise<{ blob: Blob; removedKeys: readonly string[] }>;
}

/** SnsApplyError を生成するヘルパー (cause メッセージは内部詳細を含むため UI 層でサニタイズ前提) */
function asApplyError(
  code: Exclude<SnsApplyError['code'], 'SIZE_TARGET_UNREACHABLE'>,
  cause: unknown,
): SnsApplyError {
  return {
    code,
    message: cause instanceof Error ? cause.message : String(cause),
  };
}

/**
 * SNS プロファイルを適用して画像を最適化する。
 *
 * パイプライン:
 *   blob → decode → calculateOutputDimensions → resize → encode (品質サーチ) → strip
 *
 * profile.maxFileSizeKB が指定されていれば品質バイナリサーチ、
 * 未指定なら defaultQuality 固定で 1 回 encode する。
 * profile.stripExif が true なら最終ステップで EXIF 削除。
 *
 * 重要: 例外発生時も含めて ImageBitmap は finally で close し、GPU メモリリークを防ぐ。
 */
export async function applySnsProfile(
  blob: Blob,
  profile: SnsProfile,
  deps: SnsApplyDeps,
): Promise<SnsApplyResult> {
  // プロファイルバリデーション (maxWidth が負の値は不正)
  if (profile.maxWidth < 0 || profile.maxHeight < 0) {
    const err: SnsApplyError = {
      code: 'INVALID_PROFILE',
      message: `Invalid profile dimensions: maxWidth=${profile.maxWidth}, maxHeight=${profile.maxHeight}`,
    };
    return Promise.reject(err);
  }

  // 1. デコード
  let bitmap: ImageBitmap;
  try {
    bitmap = await deps.decode(blob);
  } catch (cause) {
    if (isSnsApplyError(cause)) return Promise.reject(cause);
    return Promise.reject(asApplyError('DECODE_FAILED', cause));
  }

  // 以降の処理で例外が出ても ImageBitmap.close() を保証するため try-finally で囲む
  try {
    // 2. 出力寸法計算 (純粋関数)
    const dimensions = calculateOutputDimensions(
      { width: bitmap.width, height: bitmap.height },
      profile,
    );

    // 3. リサイズ
    let canvas: OffscreenCanvas;
    try {
      // exactOptionalPropertyTypes: cropOffset が undefined の場合はキーを渡さない
      const resizeTarget =
        dimensions.cropOffset !== undefined
          ? {
              width: dimensions.width,
              height: dimensions.height,
              cropOffset: dimensions.cropOffset,
            }
          : { width: dimensions.width, height: dimensions.height };
      canvas = await deps.resize(bitmap, resizeTarget);
    } catch (cause) {
      if (isSnsApplyError(cause)) return Promise.reject(cause);
      return Promise.reject(asApplyError('RESIZE_FAILED', cause));
    }

    const format = profile.preferredFormat;

    // 4. エンコード (品質固定 or バイナリサーチ)
    let encodedBlob: Blob;
    let finalQuality: number;
    let sizeTargetReached = true;

    if (profile.maxFileSizeKB !== undefined) {
      // 品質バイナリサーチ
      const targetSizeBytes = profile.maxFileSizeKB * 1024;

      try {
        const searchResult = await searchQuality(
          async (quality) => {
            const b = await deps.encode(canvas, format, quality);
            return { sizeBytes: b.size };
          },
          {
            targetSizeBytes,
            tolerance: 0.1,
            minQuality: 1,
            maxQuality: 100,
            maxIterations: 8,
          },
        );

        finalQuality = searchResult.quality;
        sizeTargetReached = searchResult.converged;
        // 最終品質で再 encode (searchQuality は sizeBytes のみ返すため)
        encodedBlob = await deps.encode(canvas, format, finalQuality);
      } catch (cause) {
        if (isSnsApplyError(cause)) return Promise.reject(cause);
        return Promise.reject(asApplyError('ENCODE_FAILED', cause));
      }
    } else {
      // 品質固定
      finalQuality = profile.defaultQuality;
      try {
        encodedBlob = await deps.encode(canvas, format, finalQuality);
      } catch (cause) {
        if (isSnsApplyError(cause)) return Promise.reject(cause);
        return Promise.reject(asApplyError('ENCODE_FAILED', cause));
      }
    }

    // 5. EXIF strip
    let finalBlob: Blob;
    let removedExifKeys: readonly string[];

    if (profile.stripExif) {
      const stripOptions: StripOptions =
        profile.defaultStripCategories === 'all' || profile.defaultStripCategories === undefined
          ? { remove: 'all' }
          : { remove: profile.defaultStripCategories as readonly StripCategory[] };

      const stripResult = await deps.strip(encodedBlob, stripOptions);
      finalBlob = stripResult.blob;
      removedExifKeys = stripResult.removedKeys;
    } else {
      finalBlob = encodedBlob;
      removedExifKeys = [];
    }

    return {
      blob: finalBlob,
      outputDimensions: { width: dimensions.width, height: dimensions.height },
      outputFormat: format,
      outputSizeBytes: finalBlob.size,
      quality: finalQuality,
      profileId: profile.id,
      removedExifKeys,
      sizeTargetReached,
    };
  } finally {
    // GPU メモリリーク対策: 成功・失敗を問わず ImageBitmap を解放
    bitmap.close();
  }
}

/**
 * 本番用デフォルト deps (decode/resize/encode/strip 実装をバンドル)。
 * Worker / Offscreen Document から呼ばれる想定。
 * Phase 7 で統合テストする。ブラウザ API 依存のため jsdom では動作しない。
 */
/* c8 ignore start */
export const defaultSnsApplyDeps: SnsApplyDeps = {
  decode: async (blob) => {
    const { decodeImage } = await import('@/core/image/decode');
    return decodeImage(blob);
  },
  resize: async (bitmap, target) => {
    const { resizeImage } = await import('@/core/image/resize');
    return resizeImage(bitmap, target);
  },
  encode: async (canvas, format, quality) => {
    const { encodeImage } = await import('@/core/image/encode');
    return encodeImage(canvas, format, quality);
  },
  strip: async (blob, options) => {
    const { stripExif } = await import('@/core/exif/strip');
    const result = await stripExif(blob, options);
    return { blob: result.blob, removedKeys: result.removedKeys };
  },
};
/* c8 ignore stop */

// 後方互換のため guards.ts の型ガードを再エクスポート
export { isSnsApplyError } from './guards';
