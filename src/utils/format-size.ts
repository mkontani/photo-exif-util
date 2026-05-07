/**
 * バイト数を人間が読みやすい単位 (KB / MB) に整形する純粋関数。
 * 1024 進法を採用 (Chrome の disk usage 表記と整合)。
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 寸法 (width x height) を "1920×1080" 形式の文字列に整形する */
export function formatDimensions(
  dim: { readonly width: number; readonly height: number } | undefined,
): string {
  if (dim === undefined) return '—';
  if (!Number.isFinite(dim.width) || !Number.isFinite(dim.height)) return '—';
  return `${Math.round(dim.width)}×${Math.round(dim.height)}`;
}
