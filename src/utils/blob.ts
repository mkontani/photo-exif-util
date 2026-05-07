/**
 * Blob ↔ バイナリ変換ユーティリティ。
 * JPEG strip で piexifjs が要求する binary string 形式との相互変換を担う。
 */

/**
 * ArrayBuffer を binary string (各バイトを char code として持つ文字列) に変換する。
 * piexifjs は binary string 形式の JPEG データを要求する。
 * チャンク処理で call stack overflow を防ぐ (String.fromCharCode の引数上限対策)。
 */
export function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  const chunkSize = 65536;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return result;
}

/**
 * binary string を Uint8Array に変換する。
 * piexifjs の出力 (binary string) を Blob に戻す際に使用。
 */
export function binaryStringToUint8Array(binaryStr: string): Uint8Array {
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i) & 0xff;
  }
  return bytes;
}
