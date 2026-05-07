/**
 * Blob から ImageBitmap を生成する薄いアダプタ。
 * OffscreenCanvas / Worker 環境前提。
 * Phase 7 (Playwright) で integration テストする。
 */
import type { SnsApplyError } from '@/core/sns/types';

/**
 * Blob を ImageBitmap にデコードする。
 * createImageBitmap が存在しない環境 (jsdom) では動作しない。
 *
 * @throws SnsApplyError DECODE_FAILED
 */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch (cause) {
    const err: SnsApplyError = {
      code: 'DECODE_FAILED',
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return Promise.reject(err);
  }
}
