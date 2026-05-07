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
  /**
   * EXIF 解析結果。loading 中 / エラー時は undefined になり、
   * その場合はサムネイル + 基本ファイル情報のみ表示する。
   */
  readonly summary?: ExifSummary;
  /** ファイル名 (file/drop 取り込み時のみ提供される) */
  readonly sourceName?: string;
  /** loading / error 時に表示する小さめのコンパクト版モード */
  readonly compact?: boolean;
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

  // 高リスクフィールド数を計算 (summary がある場合のみ意味がある)
  const highRiskCount = createMemo(() =>
    props.summary ? props.summary.fields.filter((f) => f.risk === 'high').length : 0,
  );

  // フォーマットを大文字表記 (summary 未確定なら "—")
  const formatLabel = createMemo(() => (props.summary ? props.summary.format.toUpperCase() : '—'));

  // compact モード: loading / error 中のサムネイル表示用 (リスク情報なし、薄いボーダー)
  // ダークモード対応: dark: バリアントで slate 系の色トークンに切替
  const containerClass = () =>
    props.compact
      ? 'flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-800/50'
      : 'flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800';

  const thumbSizeClass = () => (props.compact ? 'h-14 w-14' : 'h-20 w-20');

  return (
    <section class={containerClass()} aria-label="画像サマリー">
      <div class="flex gap-3">
        {/* サムネイル */}
        <div class="flex-shrink-0">
          <img
            src={objectUrl()}
            alt={props.sourceName ?? 'preview'}
            class={`${thumbSizeClass()} rounded border border-gray-200 object-cover dark:border-slate-600`}
          />
        </div>

        {/* メタ情報 — テキスト色は dark バリアントで slate 系に切替 */}
        <dl class="flex flex-1 flex-col gap-0.5 text-xs text-slate-700 dark:text-slate-200">
          <Show when={props.sourceName}>
            <div class="flex gap-1">
              <dt class="text-gray-500 dark:text-slate-400">
                {t('summary_filename', undefined, 'ファイル名')}:
              </dt>
              <dd class="truncate font-mono">{props.sourceName}</dd>
            </div>
          </Show>
          <Show when={props.summary}>
            <div class="flex gap-1">
              <dt class="text-gray-500 dark:text-slate-400">
                {t('summary_format', undefined, '形式')}:
              </dt>
              <dd class="font-mono">{formatLabel()}</dd>
            </div>
          </Show>
          <div class="flex gap-1">
            <dt class="text-gray-500 dark:text-slate-400">
              {t('summary_size', undefined, 'サイズ')}:
            </dt>
            <dd class="font-mono">{formatBytes(props.blob.size)}</dd>
          </div>
          <Show when={dimensions()}>
            <div class="flex gap-1">
              <dt class="text-gray-500 dark:text-slate-400">
                {t('summary_dimensions', undefined, '寸法')}:
              </dt>
              <dd class="font-mono">{formatDimensions(dimensions())}</dd>
            </div>
          </Show>
          <Show when={props.summary}>
            {(s) => (
              <div class="flex gap-1">
                <dt class="text-gray-500 dark:text-slate-400">
                  {t('summary_field_count', undefined, 'EXIF フィールド数')}:
                </dt>
                <dd class="font-mono">{s().fields.length}</dd>
              </div>
            )}
          </Show>
        </dl>
      </div>

      {/* リスク表示 (summary 確定時のみ、compact 表示でない場合) */}
      <Show when={props.summary !== undefined && !props.compact ? props.summary : undefined}>
        {(s) => (
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-gray-600 dark:text-slate-300">
              {t('app_highest_risk', undefined, '最高リスク:')}
            </span>
            <RiskBadge level={s().highestRisk} />
            <Show when={s().hasGps}>
              <span class="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                <MapPin class="h-3 w-3" aria-hidden="true" />
                {t('app_gps_present', undefined, 'GPS あり')}
              </span>
            </Show>
            <Show when={highRiskCount() > 0}>
              <span class="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                <ShieldAlert class="h-3 w-3" aria-hidden="true" />
                {t('summary_high_risk_count', undefined, '高リスクフィールド')}: {highRiskCount()}
              </span>
            </Show>
          </div>
        )}
      </Show>
    </section>
  );
}
