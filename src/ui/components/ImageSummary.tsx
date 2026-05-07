import type { ExifSummary } from '@/core/exif/types';
import { RiskBadge } from '@/ui/components/RiskBadge';
import { t } from '@/ui/i18n/t';
import { formatBytes, formatDimensions } from '@/utils/format-size';
/**
 * 取り込んだ画像のサムネイル + ファイル情報 + プライバシーリスクサマリ。
 *
 * 旧来は最高リスク + GPS 有無のみ表示していたが、ユーザーが画像が正しく
 * 読み込まれたか / 何が問題なのかを判別しやすくするため、
 * サムネイル + ファイル名 / 形式 / サイズ / 寸法 + リスク件数を併記する。
 */
import { MapPin, ShieldAlert } from 'lucide-solid';
import { Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';

interface ImageSummaryProps {
  readonly blob: Blob;
  readonly summary: ExifSummary;
  /** ファイル名 (file/drop 取り込み時のみ提供される) */
  readonly sourceName?: string;
}

/** 画像寸法を Image 経由で取得する (decode の薄いラッパ、テストでは jsdom 不可なので実機のみ動作) */
function probeDimensions(
  url: string,
): Promise<{ readonly width: number; readonly height: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(undefined);
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

export function ImageSummary(props: ImageSummaryProps) {
  // Blob URL を作成し、コンポーネント破棄時に revoke してメモリリークを防ぐ
  const objectUrl = createMemo(() => URL.createObjectURL(props.blob));
  onCleanup(() => URL.revokeObjectURL(objectUrl()));

  const [dimensions, setDimensions] = createSignal<
    { readonly width: number; readonly height: number } | undefined
  >();

  onMount(() => {
    probeDimensions(objectUrl()).then(setDimensions);
  });

  // 高リスクフィールド数を計算
  const highRiskCount = createMemo(
    () => props.summary.fields.filter((f) => f.risk === 'high').length,
  );

  // フォーマットを大文字表記
  const formatLabel = createMemo(() => props.summary.format.toUpperCase());

  return (
    <section
      class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3"
      aria-label="画像サマリー"
    >
      <div class="flex gap-3">
        {/* サムネイル */}
        <div class="flex-shrink-0">
          <img
            src={objectUrl()}
            alt={props.sourceName ?? 'preview'}
            class="h-20 w-20 rounded border border-gray-200 object-cover"
          />
        </div>

        {/* メタ情報 */}
        <dl class="flex flex-1 flex-col gap-0.5 text-xs">
          <Show when={props.sourceName}>
            <div class="flex gap-1">
              <dt class="text-gray-500">{t('summary_filename', undefined, 'ファイル名')}:</dt>
              <dd class="truncate font-mono">{props.sourceName}</dd>
            </div>
          </Show>
          <div class="flex gap-1">
            <dt class="text-gray-500">{t('summary_format', undefined, '形式')}:</dt>
            <dd class="font-mono">{formatLabel()}</dd>
          </div>
          <div class="flex gap-1">
            <dt class="text-gray-500">{t('summary_size', undefined, 'サイズ')}:</dt>
            <dd class="font-mono">{formatBytes(props.blob.size)}</dd>
          </div>
          <Show when={dimensions()}>
            <div class="flex gap-1">
              <dt class="text-gray-500">{t('summary_dimensions', undefined, '寸法')}:</dt>
              <dd class="font-mono">{formatDimensions(dimensions())}</dd>
            </div>
          </Show>
          <div class="flex gap-1">
            <dt class="text-gray-500">
              {t('summary_field_count', undefined, 'EXIF フィールド数')}:
            </dt>
            <dd class="font-mono">{props.summary.fields.length}</dd>
          </div>
        </dl>
      </div>

      {/* リスク表示 */}
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="text-gray-600">{t('app_highest_risk', undefined, '最高リスク:')}</span>
        <RiskBadge level={props.summary.highestRisk} />
        <Show when={props.summary.hasGps}>
          <span class="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800">
            <MapPin class="h-3 w-3" aria-hidden="true" />
            {t('app_gps_present', undefined, 'GPS あり')}
          </span>
        </Show>
        <Show when={highRiskCount() > 0}>
          <span class="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">
            <ShieldAlert class="h-3 w-3" aria-hidden="true" />
            {t('summary_high_risk_count', undefined, '高リスクフィールド')}: {highRiskCount()}
          </span>
        </Show>
      </div>
    </section>
  );
}
