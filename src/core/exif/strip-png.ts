/**
 * PNG EXIF strip エンジン。
 * PNG チャンクを手動でパースして不要なメタデータチャンクを削除する。
 * RFC 2083 (PNG Specification) に準拠。
 */
import { crc32 } from '@/utils/crc32';
import { shouldKeepIcc } from '@/utils/strip-options';
import type { StripOptions } from './strip';

/** PNG シグネチャ (8 bytes) */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** デフォルトで削除するチャンクタイプ */
const META_CHUNK_TYPES: ReadonlySet<string> = new Set([
  'tEXt', // テキストメタデータ
  'iTXt', // 国際化テキストメタデータ
  'zTXt', // 圧縮テキストメタデータ
  'eXIf', // PNG 1.5+ EXIF チャンク
  'iCCP', // ICC プロファイル (keep: ['icc'] 指定時は保持)
]);

/** 必須チャンクタイプ (絶対に削除しない) */
const REQUIRED_CHUNK_TYPES: ReadonlySet<string> = new Set(['IHDR', 'IDAT', 'IEND', 'PLTE']);

/** チャンク情報 */
interface PngChunk {
  readonly type: string;
  readonly data: Uint8Array;
  /** チャンクのバイトオフセット (length フィールドの先頭) */
  readonly offset: number;
}

/** PNG バイト列から全チャンクをパースする */
function parsePngChunks(bytes: Uint8Array): readonly PngChunk[] {
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length; // シグネチャ分をスキップ

  while (offset + 8 <= bytes.length) {
    const length =
      ((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0);

    if (length < 0) break; // 異常値

    const type = String.fromCharCode(
      bytes[offset + 4] ?? 0,
      bytes[offset + 5] ?? 0,
      bytes[offset + 6] ?? 0,
      bytes[offset + 7] ?? 0,
    );

    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd > bytes.length) break; // バッファ外

    const data = bytes.slice(dataStart, dataEnd);

    chunks.push({ type, data, offset });
    offset = dataEnd + 4; // CRC をスキップ
  }

  return chunks;
}

/** チャンクのバイト列を構築する (length + type + data + CRC) */
function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const length = data.length;

  // CRC は type + data に対して計算する
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const checksum = crc32(crcInput);

  // length(4BE) + type(4) + data + crc(4BE)
  const result = new Uint8Array(4 + 4 + length + 4);
  result[0] = (length >>> 24) & 0xff;
  result[1] = (length >>> 16) & 0xff;
  result[2] = (length >>> 8) & 0xff;
  result[3] = length & 0xff;
  result.set(typeBytes, 4);
  result.set(data, 8);
  result[8 + length] = (checksum >>> 24) & 0xff;
  result[9 + length] = (checksum >>> 16) & 0xff;
  result[10 + length] = (checksum >>> 8) & 0xff;
  result[11 + length] = checksum & 0xff;

  return result;
}

export interface PngStripResult {
  readonly blob: Blob;
  readonly removedKeys: readonly string[];
  readonly format: 'png';
}

/**
 * PNG Blob からメタデータチャンクを削除する。
 *
 * @param blob - 入力 PNG Blob
 * @param options - StripOptions (remove/keep)
 * @returns 削除後の PNG Blob と削除キー一覧
 */
export async function stripPng(blob: Blob, options: StripOptions = {}): Promise<PngStripResult> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const { remove, keep } = options;

  // 削除しないチャンクタイプを決定する
  const keepIcc = shouldKeepIcc(remove, keep);

  // チャンクをパースして必要なものだけ残す
  const chunks = parsePngChunks(bytes);
  const removedKeys: string[] = [];

  const keptChunks: PngChunk[] = [];
  for (const chunk of chunks) {
    if (REQUIRED_CHUNK_TYPES.has(chunk.type)) {
      // 必須チャンクは無条件に保持
      keptChunks.push(chunk);
      continue;
    }

    if (chunk.type === 'iCCP') {
      if (keepIcc) {
        keptChunks.push(chunk);
      } else {
        removedKeys.push('iCCP');
      }
      continue;
    }

    if (META_CHUNK_TYPES.has(chunk.type)) {
      // メタチャンクを削除: tEXt のキーワードを removedKeys に記録
      const keyName = extractChunkKey(chunk);
      removedKeys.push(keyName);
      continue;
    }

    // その他のチャンクは保持する (ancillary chunks)
    keptChunks.push(chunk);
  }

  // 出力バイト列を構築する
  const resultParts: Uint8Array[] = [PNG_SIGNATURE];
  for (const chunk of keptChunks) {
    resultParts.push(buildPngChunk(chunk.type, chunk.data));
  }

  // 結合
  const totalLength = resultParts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of resultParts) {
    result.set(part, offset);
    offset += part.length;
  }

  return {
    blob: new Blob([result], { type: 'image/png' }),
    removedKeys,
    format: 'png',
  };
}

/**
 * チャンクから removedKeys に記録するキー名を抽出する。
 * tEXt/zTXt はキーワード部分を返す。その他はチャンクタイプをそのまま返す。
 */
function extractChunkKey(chunk: PngChunk): string {
  if (chunk.type === 'tEXt' || chunk.type === 'zTXt') {
    // tEXt: keyword\0value 形式
    const nullIdx = chunk.data.indexOf(0x00);
    if (nullIdx > 0) {
      return new TextDecoder().decode(chunk.data.slice(0, nullIdx));
    }
  }
  if (chunk.type === 'iTXt') {
    // iTXt: keyword\0... 形式
    const nullIdx = chunk.data.indexOf(0x00);
    if (nullIdx > 0) {
      return new TextDecoder().decode(chunk.data.slice(0, nullIdx));
    }
  }
  return chunk.type;
}
