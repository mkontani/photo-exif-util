/**
 * WebP EXIF strip エンジン。
 * RIFF コンテナを手動でパースして不要なチャンクを削除する。
 * WebP Container Specification に準拠。
 */
import { shouldKeepIcc } from '@/utils/strip-options';
import type { StripOptions } from './strip';

/**
 * VP8X チャンク data の先頭バイト (flags) における各機能のビット位置。
 * 仕様: https://developers.google.com/speed/webp/docs/riff_container#extended_file_format
 *   bit 0: reserved
 *   bit 1: ICC profile (I)
 *   bit 2: alpha (L)
 *   bit 3: EXIF metadata (E)
 *   bit 4: XMP metadata (X)
 *   bit 5: animation (A)
 *   bit 6-7: reserved
 */
const VP8X_FLAG_ICC = 1 << 1;
const VP8X_FLAG_EXIF = 1 << 3;
const VP8X_FLAG_XMP = 1 << 4;

/** WebP で削除対象となるメタデータチャンク FourCC */
const META_CHUNK_FOURCCS: ReadonlySet<string> = new Set([
  'EXIF', // EXIF データ
  'XMP ', // XMP メタデータ (4文字目はスペース)
  'ICCP', // ICC プロファイル (keep: ['icc'] 時は保持)
]);

/** 必須チャンク FourCC (絶対に削除しない) */
const REQUIRED_CHUNK_FOURCCS: ReadonlySet<string> = new Set([
  'VP8 ', // VP8 lossy
  'VP8L', // VP8 lossless
  'VP8X', // Extended features header
  'ANIM', // Animation header
  'ANMF', // Animation frame
  'ALPH', // Alpha data
]);

/** RIFF チャンク情報 */
interface RiffChunk {
  readonly fourCC: string;
  readonly size: number;
  readonly data: Uint8Array;
}

/** RIFF コンテナから全チャンクをパースする */
function parseRiffChunks(bytes: Uint8Array): readonly RiffChunk[] {
  const chunks: RiffChunk[] = [];
  // RIFF(4) + size(4) + WEBP(4) = 12 bytes のヘッダーをスキップ
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const fourCC = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );

    const size =
      (bytes[offset + 4] ?? 0) |
      ((bytes[offset + 5] ?? 0) << 8) |
      ((bytes[offset + 6] ?? 0) << 16) |
      ((bytes[offset + 7] ?? 0) << 24);

    // size は signed 32bit で読むため、最上位ビットがあれば負値として弾かれる。
    // chunk が容器に収まらない場合も break (オフバイワン許容しない)。
    if (size < 0 || offset + 8 + size > bytes.length) break;

    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    const data = bytes.slice(dataStart, Math.min(dataEnd, bytes.length));

    chunks.push({ fourCC, size, data });

    // WebP チャンクはサイズが奇数なら 1 byte パディングがある
    offset += 8 + size + (size % 2 === 1 ? 1 : 0);
  }

  return chunks;
}

/** LE 32-bit 整数を Uint8Array に変換する */
function le32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}

/** チャンクのバイト列を構築する (FourCC + size(4LE) + data + optional padding) */
function buildRiffChunk(fourCC: string, data: Uint8Array): Uint8Array {
  const fourCCBytes = new TextEncoder().encode(fourCC);
  const size = data.length;
  const padding = size % 2 === 1 ? 1 : 0;

  const result = new Uint8Array(8 + size + padding);
  result.set(fourCCBytes, 0);
  result.set(le32(size), 4);
  result.set(data, 8);
  // パディングバイトは 0x00 (デフォルトで 0 埋め)

  return result;
}

export interface WebpStripResult {
  readonly blob: Blob;
  readonly removedKeys: readonly string[];
  readonly format: 'webp';
}

/**
 * WebP Blob からメタデータチャンクを削除する。
 * RIFF size header を削除後に再計算する。
 *
 * @param blob - 入力 WebP Blob
 * @param options - StripOptions (remove/keep)
 * @returns 削除後の WebP Blob と削除キー一覧
 */
export async function stripWebp(blob: Blob, options: StripOptions = {}): Promise<WebpStripResult> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const { remove, keep } = options;

  // ICC プロファイルチャンクを保持すべきかを判定
  const keepIcc = shouldKeepIcc(remove, keep);

  // RIFF チャンクをパース
  const chunks = parseRiffChunks(bytes);
  const removedKeys: string[] = [];
  const keptChunks: RiffChunk[] = [];

  // VP8X フラグ更新のため削除実績を追跡
  let removedExif = false;
  let removedXmp = false;
  let removedIcc = false;

  for (const chunk of chunks) {
    if (REQUIRED_CHUNK_FOURCCS.has(chunk.fourCC)) {
      // 必須チャンクは無条件に保持 (VP8X フラグは後で更新)
      keptChunks.push(chunk);
      continue;
    }

    if (chunk.fourCC === 'ICCP') {
      if (keepIcc) {
        keptChunks.push(chunk);
      } else {
        removedKeys.push('ICCP');
        removedIcc = true;
      }
      continue;
    }

    if (META_CHUNK_FOURCCS.has(chunk.fourCC)) {
      // メタチャンクを削除し、対応する VP8X フラグを後でクリアする
      const trimmed = chunk.fourCC.trimEnd(); // 例: "XMP " → "XMP"
      removedKeys.push(trimmed);
      if (chunk.fourCC === 'EXIF') removedExif = true;
      if (chunk.fourCC === 'XMP ') removedXmp = true;
      continue;
    }

    // その他のチャンクは保持する
    keptChunks.push(chunk);
  }

  // VP8X チャンクのフラグビットを削除実績に応じてクリアする (仕様遵守)
  if (removedExif || removedXmp || removedIcc) {
    for (let i = 0; i < keptChunks.length; i++) {
      const chunk = keptChunks[i];
      /* c8 ignore next -- chunk?.fourCC は ループ内で常に定義済み、data.length===0 は仕様上不正な VP8X */
      if (chunk?.fourCC !== 'VP8X' || chunk.data.length === 0) continue;
      const newData = new Uint8Array(chunk.data);
      let flags = newData[0] ?? 0;
      if (removedExif) flags &= ~VP8X_FLAG_EXIF;
      if (removedXmp) flags &= ~VP8X_FLAG_XMP;
      if (removedIcc) flags &= ~VP8X_FLAG_ICC;
      newData[0] = flags;
      keptChunks[i] = { fourCC: 'VP8X', size: newData.length, data: newData };
      break; // VP8X は WebP 仕様で 1 つだけ
    }
  }

  // 出力バイト列を構築する
  // WEBP タグ (4 bytes)
  const webpTag = new TextEncoder().encode('WEBP');

  // チャンク部分のバイト列を構築
  const chunkParts: Uint8Array[] = [];
  for (const chunk of keptChunks) {
    chunkParts.push(buildRiffChunk(chunk.fourCC, chunk.data));
  }

  const chunksLength = chunkParts.reduce((sum, p) => sum + p.length, 0);

  // RIFF ペイロード: WEBP + chunks
  const payloadSize = 4 + chunksLength; // WEBP(4) + chunks

  // RIFF ヘッダー: "RIFF" + size(4LE) + payload
  const riffTag = new TextEncoder().encode('RIFF');
  const totalSize = 4 + 4 + payloadSize; // RIFF(4) + size(4) + payload

  const result = new Uint8Array(totalSize);
  result.set(riffTag, 0);
  result.set(le32(payloadSize), 4); // RIFF size = payload サイズ
  result.set(webpTag, 8);

  let offset = 12;
  for (const part of chunkParts) {
    result.set(part, offset);
    offset += part.length;
  }

  return {
    blob: new Blob([result], { type: 'image/webp' }),
    removedKeys,
    format: 'webp',
  };
}
