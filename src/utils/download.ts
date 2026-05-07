/**
 * 単体ファイルダウンロードの薄いアダプタ。
 * URL.createObjectURL + <a download> 経由で Blob をダウンロードさせる。
 * 完了後に URL を revoke してメモリリークを防ぐ。
 *
 * ブラウザ依存 API のため coverage 対象外 (vitest.config.ts で exclude)。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
