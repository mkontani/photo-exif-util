/**
 * ImageBitmap を指定寸法にリサイズする薄いアダプタ。
 * pica で Lanczos3 リサイズ + OffscreenCanvas を使用。
 * Phase 7 (Playwright) で integration テストする。
 */
import { isSnsApplyError } from '@/core/sns/guards';
import type { SnsApplyError } from '@/core/sns/types';

/**
 * ImageBitmap を指定寸法にリサイズする。
 * cropOffset が指定されていれば cover モードのクロップを先に行う。
 * 戻り値は OffscreenCanvas (encode に渡せる)。
 *
 * @throws SnsApplyError RESIZE_FAILED
 */
export async function resizeImage(
  bitmap: ImageBitmap,
  target: {
    readonly width: number;
    readonly height: number;
    readonly cropOffset?: { readonly x: number; readonly y: number };
  },
): Promise<OffscreenCanvas> {
  try {
    // pica は動的インポートで読み込む (Worker 環境対応)
    const { default: Pica } = await import('pica');
    const pica = new Pica();

    // クロップが必要な場合は中間 canvas を作成して切り出す
    let sourceCanvas: OffscreenCanvas;
    if (target.cropOffset !== undefined) {
      const { x, y } = target.cropOffset;
      // クロップ後のサイズはターゲットアスペクト比に合った最大サイズ
      // cropOffset は入力座標系なので bitmap の縮小後サイズを逆算する
      const cropW = bitmap.width - x * 2;
      const cropH = bitmap.height - y * 2;
      sourceCanvas = new OffscreenCanvas(cropW, cropH);
      const ctx = sourceCanvas.getContext('2d');
      if (ctx === null) throw new Error('Failed to get 2d context for crop');
      ctx.drawImage(bitmap, -x, -y);
    } else {
      sourceCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = sourceCanvas.getContext('2d');
      if (ctx === null) throw new Error('Failed to get 2d context');
      ctx.drawImage(bitmap, 0, 0);
    }

    const destCanvas = new OffscreenCanvas(target.width, target.height);
    // pica の型定義は HTMLCanvasElement を想定しているが、
    // Worker 環境では OffscreenCanvas を使う。実行時は正常動作するため cast する。
    await pica.resize(
      sourceCanvas as unknown as HTMLCanvasElement,
      destCanvas as unknown as HTMLCanvasElement,
      {
        quality: 3, // Lanczos3
        unsharpAmount: 0.5,
        unsharpRadius: 0.5,
        unsharpThreshold: 0,
      },
    );

    return destCanvas;
  } catch (cause) {
    // 既に SnsApplyError なら re-throw
    if (isSnsApplyError(cause)) return Promise.reject(cause);
    const err: SnsApplyError = {
      code: 'RESIZE_FAILED',
      message: cause instanceof Error ? cause.message : String(cause),
    };
    return Promise.reject(err);
  }
}
