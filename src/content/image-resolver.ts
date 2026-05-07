/**
 * Content Script: ページ上の <img> から画像 URL を解決して Background に送る補助関数。
 * DOM API に依存するため coverage exclude 対象。Phase 5 で UI 実装後に連携する。
 */

/**
 * CSS セレクタに一致する最初の <img> 要素の src を返す。
 * 要素が見つからない場合は null を返す。
 *
 * @param targetSelector CSS セレクタ
 */
export async function resolveImageFromDom(targetSelector: string): Promise<string | null> {
  const img = document.querySelector<HTMLImageElement>(targetSelector);
  return img?.src ?? null;
}
