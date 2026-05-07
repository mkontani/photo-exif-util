/**
 * base64 エンコード / デコードのユーティリティ。
 * btoa/atob を使った標準実装。
 * Background SW から Blob を Side Panel に渡す際の中間表現として使用する。
 *
 * Phase 7 では Transferable / SharedArrayBuffer による最適化を検討する。
 */

/**
 * ArrayBuffer を base64 文字列にエンコードする (純粋関数)。
 * 空の ArrayBuffer は空文字を返す。
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) {
    return '';
  }

  // btoa は Latin-1 文字列を受け取るため、各バイトを文字に変換する
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    // noUncheckedIndexedAccess: bytes[i] は Uint8Array のため必ず number
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

/**
 * base64 文字列を Uint8Array にデコードする (純粋関数)。
 * 空文字は空の Uint8Array を返す。
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (base64 === '') {
    return new Uint8Array(0);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
