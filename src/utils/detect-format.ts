import type { ImageFormat } from '@/core/exif/types';

/**
 * 画像 Blob の先頭バイトからマジックナンバーで画像フォーマットを判定する。
 * EXIF parse / strip 双方で共通利用する。
 */
export async function detectImageFormat(blob: Blob): Promise<ImageFormat> {
  // 先頭 12 バイトで判定 (RIFF...WEBP の WEBP までをカバーするための最小幅)
  const header = await blob.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(header);

  if (bytes.length < 2) return 'unknown';

  // JPEG: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }

  // WebP: RIFF????WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return 'unknown';
}
