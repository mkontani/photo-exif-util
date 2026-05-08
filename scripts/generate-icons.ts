/**
 * アイコンプレースホルダー生成スクリプト。
 * Node.js の組み込み機能のみで最小有効 PNG を生成する。
 * sharp / canvas / ImageMagick 不要。
 *
 * 生成されるアイコンは単色の正方形 PNG (プレースホルダー)。
 * 本番リリース前に差し替えること。
 *
 * 使い方:
 *   pnpm gen:icons          既存ファイルが無いサイズのみ生成 (デフォルトで非破壊)
 *   pnpm gen:icons --force  本番アイコンも含めて全サイズ強制再生成
 *
 * 本スクリプトは破壊的なので、`pnpm release` からは外している。
 * 過去のリリースで本番アイコンがプレースホルダで上書きされた経緯があるため、
 * 既定挙動は skip-if-exists とし、`--force` でのみ上書きを許す。
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUTPUT_DIR = 'public/icons';

/** PNG ファイルシグネチャ */
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** CRC-32 テーブルを生成する */
function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    const idx = (crc ^ byte) & 0xff;
    const tableVal = CRC32_TABLE[idx] ?? 0;
    crc = tableVal ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const buf = new Uint8Array(4 + 4 + data.length + 4);
  // length
  writeUint32BE(buf, 0, data.length);
  // type
  buf.set(typeBytes, 4);
  // data
  buf.set(data, 8);
  // CRC over type + data
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  writeUint32BE(buf, 8 + data.length, crc32(crcInput));
  return buf;
}

/**
 * 単色 RGBA PNG を生成する。
 * @param size 正方形のサイズ (ピクセル)
 * @param r 赤 (0-255)
 * @param g 緑 (0-255)
 * @param b 青 (0-255)
 * @param a アルファ (0-255)
 */
export function generateSolidPng(
  size: number,
  r: number,
  g: number,
  b: number,
  a: number,
): Uint8Array {
  // IHDR チャンク
  const ihdrData = new Uint8Array(13);
  writeUint32BE(ihdrData, 0, size); // width
  writeUint32BE(ihdrData, 4, size); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  // IDAT チャンク: 生 (非圧縮) deflate ブロック
  // 各行: filter byte (0x00) + RGBA × size
  const rowSize = 1 + size * 4;
  const rawData = new Uint8Array(size * rowSize);
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0x00; // filter type: None
    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // zlib ラップした deflate (非圧縮ブロック)
  // zlib ヘッダー: CMF=0x78 (deflate, window=32K), FLG を調整
  const zlibHeader = new Uint8Array([0x78, 0x01]);
  // deflate 非圧縮ブロック: BFINAL=1, BTYPE=00
  const maxBlockSize = 65535;
  const blocks: Uint8Array[] = [];
  let offset = 0;
  while (offset < rawData.length) {
    const blockLen = Math.min(maxBlockSize, rawData.length - offset);
    const isLast = offset + blockLen >= rawData.length;
    const blockHeader = new Uint8Array(5);
    blockHeader[0] = isLast ? 0x01 : 0x00; // BFINAL / BTYPE
    blockHeader[1] = blockLen & 0xff;
    blockHeader[2] = (blockLen >> 8) & 0xff;
    blockHeader[3] = ~blockLen & 0xff;
    blockHeader[4] = (~blockLen >> 8) & 0xff;
    blocks.push(blockHeader);
    blocks.push(rawData.slice(offset, offset + blockLen));
    offset += blockLen;
  }

  // Adler-32 チェックサム
  let s1 = 1;
  let s2 = 0;
  for (const byte of rawData) {
    s1 = (s1 + byte) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = new Uint8Array(4);
  // 符号なし扱いで明示 (s2 >= 0x8000 で符号付き 32bit が負になる JS の挙動を防ぐ)
  writeUint32BE(adler, 0, ((s2 << 16) | s1) >>> 0);

  // zlib データを結合
  const totalBlockLen = blocks.reduce((sum, blk) => sum + blk.length, 0);
  const zlibData = new Uint8Array(zlibHeader.length + totalBlockLen + adler.length);
  let pos = 0;
  zlibData.set(zlibHeader, pos);
  pos += zlibHeader.length;
  for (const block of blocks) {
    zlibData.set(block, pos);
    pos += block.length;
  }
  zlibData.set(adler, pos);

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', zlibData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const totalLen = PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let writePos = 0;
  png.set(PNG_SIGNATURE, writePos);
  writePos += PNG_SIGNATURE.length;
  png.set(ihdrChunk, writePos);
  writePos += ihdrChunk.length;
  png.set(idatChunk, writePos);
  writePos += idatChunk.length;
  png.set(iendChunk, writePos);

  return png;
}

/**
 * ピクセルバッファに円を描画する。
 * @param pixels RGBA フラットバッファ (size * size * 4 bytes)
 * @param size 画像の一辺サイズ
 * @param cx 円中心 X
 * @param cy 円中心 Y
 * @param r 半径
 * @param color RGBA 配列
 */
function drawCircle(
  pixels: Uint8Array,
  size: number,
  cx: number,
  cy: number,
  r: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const idx = (y * size + x) * 4;
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = color[3];
      }
    }
  }
}

/**
 * ピクセルバッファに矩形を描画する。
 * @param pixels RGBA フラットバッファ
 * @param size 画像の一辺サイズ
 * @param x1 左上 X
 * @param y1 左上 Y
 * @param x2 右下 X (inclusive)
 * @param y2 右下 Y (inclusive)
 * @param color RGBA 配列
 */
function drawRect(
  pixels: Uint8Array,
  size: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: readonly [number, number, number, number],
): void {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const rx1 = clamp(x1, 0, size - 1);
  const rx2 = clamp(x2, 0, size - 1);
  const ry1 = clamp(y1, 0, size - 1);
  const ry2 = clamp(y2, 0, size - 1);
  for (let y = ry1; y <= ry2; y++) {
    for (let x = rx1; x <= rx2; x++) {
      const idx = (y * size + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }
}

/**
 * ピクセルバッファから PNG を生成するヘルパー。
 * generateSolidPng と同じ PNG エンコードロジックを使う。
 */
function pixelsToPng(pixels: Uint8Array, size: number): Uint8Array {
  // IHDR チャンク
  const ihdrData = new Uint8Array(13);
  writeUint32BE(ihdrData, 0, size); // width
  writeUint32BE(ihdrData, 4, size); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  // IDAT: フィルタバイト (0x00) + RGBA 各行
  const rowSize = 1 + size * 4;
  const rawData = new Uint8Array(size * rowSize);
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0x00; // filter type: None
    for (let x = 0; x < size; x++) {
      const srcIdx = (y * size + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx] ?? 0;
      rawData[dstIdx + 1] = pixels[srcIdx + 1] ?? 0;
      rawData[dstIdx + 2] = pixels[srcIdx + 2] ?? 0;
      rawData[dstIdx + 3] = pixels[srcIdx + 3] ?? 0;
    }
  }

  // zlib ラップ + deflate 非圧縮ブロック
  const zlibHeader = new Uint8Array([0x78, 0x01]);
  const maxBlockSize = 65535;
  const blocks: Uint8Array[] = [];
  let offset = 0;
  while (offset < rawData.length) {
    const blockLen = Math.min(maxBlockSize, rawData.length - offset);
    const isLast = offset + blockLen >= rawData.length;
    const blockHeader = new Uint8Array(5);
    blockHeader[0] = isLast ? 0x01 : 0x00;
    blockHeader[1] = blockLen & 0xff;
    blockHeader[2] = (blockLen >> 8) & 0xff;
    blockHeader[3] = ~blockLen & 0xff;
    blockHeader[4] = (~blockLen >> 8) & 0xff;
    blocks.push(blockHeader);
    blocks.push(rawData.slice(offset, offset + blockLen));
    offset += blockLen;
  }

  // Adler-32 チェックサム
  let s1 = 1;
  let s2 = 0;
  for (const byte of rawData) {
    s1 = (s1 + byte) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = new Uint8Array(4);
  // 符号なし扱いで明示 (s2 >= 0x8000 で符号付き 32bit が負になる JS の挙動を防ぐ)
  writeUint32BE(adler, 0, ((s2 << 16) | s1) >>> 0);

  const totalBlockLen = blocks.reduce((sum, blk) => sum + blk.length, 0);
  const zlibData = new Uint8Array(zlibHeader.length + totalBlockLen + adler.length);
  let pos = 0;
  zlibData.set(zlibHeader, pos);
  pos += zlibHeader.length;
  for (const block of blocks) {
    zlibData.set(block, pos);
    pos += block.length;
  }
  zlibData.set(adler, pos);

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', zlibData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const totalLen = PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let writePos = 0;
  png.set(PNG_SIGNATURE, writePos);
  writePos += PNG_SIGNATURE.length;
  png.set(ihdrChunk, writePos);
  writePos += ihdrChunk.length;
  png.set(idatChunk, writePos);
  writePos += idatChunk.length;
  png.set(iendChunk, writePos);

  return png;
}

/**
 * 「円形背景 + 文字 P」アイコン PNG を生成する (Approach 1)。
 * 依存ライブラリなし、Node.js 組み込み機能のみで生成する。
 *
 * @param size 正方形サイズ (ピクセル)
 * @returns PNG バイト列
 */
export function generateCirclePng(size: number): Uint8Array {
  // 透明背景
  const pixels = new Uint8Array(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;
  const r = Math.floor(size * 0.45);

  // 青い円形背景 (#3B82F6)
  const blue: readonly [number, number, number, number] = [59, 130, 246, 255];
  drawCircle(pixels, size, cx, cy, r, blue);

  // 文字「P」を白い矩形で描画する
  // P = 縦棒 + 上部に半円状の突起 (矩形 2 本で近似)
  const white: readonly [number, number, number, number] = [255, 255, 255, 255];
  const strokeW = Math.max(1, Math.floor(size * 0.1)); // 線幅
  const charH = Math.floor(size * 0.55); // 文字高さ
  const charW = Math.floor(size * 0.3); // 文字幅
  const startX = Math.floor(cx - charW * 0.5);
  const startY = Math.floor(cy - charH * 0.5);

  // 縦棒
  drawRect(pixels, size, startX, startY, startX + strokeW - 1, startY + charH - 1, white);

  // 上横棒 (P の上部)
  drawRect(pixels, size, startX, startY, startX + charW - 1, startY + strokeW - 1, white);

  // 中横棒 (P の膨らみ下端)
  const midY = startY + Math.floor(charH * 0.45);
  drawRect(pixels, size, startX, midY, startX + charW - 1, midY + strokeW - 1, white);

  // 右縦棒 (P の右側: 上半分のみ)
  drawRect(
    pixels,
    size,
    startX + charW - strokeW,
    startY,
    startX + charW - 1,
    midY + strokeW - 1,
    white,
  );

  return pixelsToPng(pixels, size);
}

/**
 * 既存アイコンを上書きすべきかを判定する純粋関数。
 *
 *  - 存在しないなら常に書く
 *  - 存在する場合は force=true のときだけ書く
 *
 * 引数で `exists` を渡すことで fs を分離してテスト可能にする。
 */
export function shouldWriteIcon(exists: boolean, force: boolean): boolean {
  return !exists || force;
}

/** `--force` / `-f` フラグの有無を argv から検出する純粋関数。 */
export function parseForceFlag(argv: readonly string[]): boolean {
  return argv.includes('--force') || argv.includes('-f');
}

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  const force = parseForceFlag(process.argv.slice(2));

  // Photo EXIF Util アイコン: 円形背景 + 文字 P (Approach 1)
  const sizes = [16, 32, 48, 128] as const;
  let written = 0;
  let skipped = 0;
  for (const size of sizes) {
    const outPath = join(OUTPUT_DIR, `icon-${size}.png`);
    if (!shouldWriteIcon(existsSync(outPath), force)) {
      console.log(`Skipped ${outPath} (already exists; pass --force to overwrite)`);
      skipped++;
      continue;
    }
    const png = generateCirclePng(size);
    await writeFile(outPath, png);
    console.log(`Wrote ${outPath} (${png.length} bytes)`);
    written++;
  }

  console.log(`Icons: ${written} written, ${skipped} skipped.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
