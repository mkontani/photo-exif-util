/**
 * CRC32 計算ユーティリティ。
 * PNG チャンクの整合性検証に使用する。
 * tests/helpers/build-fixtures.ts と同じアルゴリズムを共通化。
 */

/** CRC32 テーブルを生成する (IEEE 多項式 0xEDB88320) */
function makeCrc32Table(): readonly number[] {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c);
  }
  return table;
}

// テーブルはモジュールロード時に一度だけ生成してキャッシュ
const CRC32_TABLE: readonly number[] = makeCrc32Table();

/**
 * Uint8Array の CRC32 チェックサムを計算する。
 * 戻り値は unsigned 32-bit integer。
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
