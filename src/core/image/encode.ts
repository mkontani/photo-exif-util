/**
 * OffscreenCanvas を Blob にエンコードする薄いアダプタ。
 * Phase 7 (Playwright) で integration テストする。
 */
import type { OutputFormat, SnsApplyError } from '@/core/sns/types';

/**
 * OffscreenCanvas を指定フォーマット・品質で Blob にエンコードする。
 * quality は 0-100 の整数で受け取り、convertToBlob の 0-1 に変換する。
 *
 * @throws SnsApplyError ENCODE_FAILED
 */
export async function encodeImage(
  canvas: OffscreenCanvas,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  try {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
    // quality を 0-1 スケールに正規化
    const normalizedQuality = Math.max(0, Math.min(1, quality / 100));
    const blob = await canvas.convertToBlob({ type: mimeType, quality: normalizedQuality });
    if (blob === null) {
      throw new Error('convertToBlob returned null');
    }
    return blob;
  } catch (cause) {
    const err: SnsApplyError = {
      code: 'ENCODE_FAILED',
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return Promise.reject(err);
  }
}
