/**
 * EXIF strip ルートのパネルコンポーネント。
 * カテゴリ選択 → 実行 → ダウンロードの UI を提供する。
 *
 * onStripExif を DI できるようにして、テスト時に実際の strip 処理を差し替え可能にする。
 * 本番では import した stripExif をデフォルト値として使う。
 */
import type { StripCategory, StripOptions, StripResult } from '@/core/exif/strip';
import { stripExif as defaultStripExif } from '@/core/exif/strip';
import type { ExifSummary } from '@/core/exif/types';
import { buildStripOptions, initialStripState, stripReducer } from '@/state/strip-store';
import { t } from '@/ui/i18n/t';
import { downloadBlob } from '@/utils/download';
import { safeFilename } from '@/utils/filename';
import { For, Show, createSignal } from 'solid-js';

/** 並び順固定のカテゴリリスト (icc / other は別管理) */
const ORDERED_CATEGORIES = [
  'gps',
  'device',
  'lens',
  'capture',
  'datetime',
  'software',
  'orientation',
] as const satisfies readonly StripCategory[];

type OrderedCategory = (typeof ORDERED_CATEGORIES)[number];

/** i18n キー + JA fallback ペア。chrome.i18n が未初期化の jsdom でも JA を返せるように fallback を保持。 */
const CATEGORY_I18N: Record<OrderedCategory, { readonly key: string; readonly ja: string }> = {
  gps: { key: 'strip_category_gps', ja: 'GPS' },
  device: { key: 'strip_category_device', ja: 'デバイス' },
  lens: { key: 'strip_category_lens', ja: 'レンズ' },
  capture: { key: 'strip_category_capture', ja: '撮影設定' },
  datetime: { key: 'strip_category_datetime', ja: '日時' },
  software: { key: 'strip_category_software', ja: 'ソフトウェア' },
  orientation: { key: 'strip_category_orientation', ja: '向き' },
};

function categoryLabel(category: OrderedCategory): string {
  const { key, ja } = CATEGORY_I18N[category];
  return t(key, undefined, ja);
}

interface StripPanelProps {
  readonly blob: Blob;
  readonly summary: ExifSummary;
  readonly onComplete?: (result: StripResult) => void;
  /** テスト時に差し替える DI: デフォルトは stripExif */
  readonly onStripExif?: (blob: Blob, options: StripOptions) => Promise<StripResult>;
}

export function StripPanel(props: StripPanelProps) {
  const [state, setState] = createSignal(initialStripState);

  function dispatch(action: Parameters<typeof stripReducer>[1]) {
    setState((s) => stripReducer(s, action));
  }

  async function handleStrip() {
    dispatch({ type: 'STRIP_START' });

    const options = buildStripOptions(state());
    const stripFn = props.onStripExif ?? defaultStripExif;

    try {
      const result = await stripFn(props.blob, options);
      dispatch({ type: 'STRIP_SUCCESS', result });
      props.onComplete?.(result);
    } catch (err: unknown) {
      const errObj = err as Partial<{ code: string; message: string }>;
      dispatch({
        type: 'STRIP_ERROR',
        code: errObj.code ?? 'STRIP_ERROR',
        message: errObj.message ?? t('strip_error_default', undefined, 'EXIF 削除に失敗しました'),
      });
    }
  }

  function handleDownload() {
    const result = state().result;
    if (!result) return;
    const ext = result.format === 'jpeg' ? '.jpg' : `.${result.format}`;
    const filename = safeFilename(`stripped${ext}`);
    downloadBlob(result.blob, filename);
  }

  const isRunning = () => state().status === 'running';

  return (
    <div class="flex flex-col gap-4">
      {/* カテゴリ選択 */}
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">
            {t('strip_label_categories', undefined, '削除カテゴリ')}
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SELECT_ALL' })}
            class="text-xs text-blue-500 underline hover:text-blue-700"
          >
            {t('strip_button_select_all', undefined, '全選択')}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SELECT_NONE' })}
            class="text-xs text-gray-500 underline hover:text-gray-700"
          >
            {t('strip_button_select_none', undefined, '全解除')}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-1">
          <For each={ORDERED_CATEGORIES}>
            {(category) => (
              <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
                <input
                  type="checkbox"
                  data-category={category}
                  checked={state().selectedCategories.includes(category)}
                  onChange={() => dispatch({ type: 'TOGGLE_CATEGORY', category })}
                  class="cursor-pointer"
                />
                <span class="text-sm">{categoryLabel(category)}</span>
              </label>
            )}
          </For>
        </div>

        {/* ICC プロファイル保持トグル */}
        <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
          <input
            type="checkbox"
            checked={state().keepIcc}
            onChange={() => dispatch({ type: 'TOGGLE_KEEP_ICC' })}
            aria-label={t('strip_label_keep_icc', undefined, 'ICC プロファイルを保持する')}
            class="cursor-pointer"
          />
          <span class="text-sm">
            {t('strip_label_keep_icc', undefined, 'ICC プロファイルを保持する')}
          </span>
        </label>
      </div>

      {/* 実行ボタン */}
      <button
        type="button"
        onClick={handleStrip}
        disabled={isRunning() || state().selectedCategories.length === 0}
        class="rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Show when={isRunning()} fallback={t('strip_button_run', undefined, 'EXIF を削除')}>
          {t('strip_button_running', undefined, '削除中...')}
        </Show>
      </button>

      {/* エラー表示 */}
      <Show when={state().status === 'error'}>
        <div
          class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          <strong>{t('app_error_prefix', undefined, 'エラー:')}</strong> {state().errorMessage}
        </div>
      </Show>

      {/* 成功: 削除キー一覧 + ダウンロード */}
      {/* Show の accessor パターンで result の non-null を型安全に扱う */}
      <Show when={state().status === 'success' ? state().result : undefined}>
        {(result) => (
          <div class="flex flex-col gap-2">
            <div class="text-sm text-gray-600">
              {t(
                'strip_removed_count',
                [String(result().removedKeys.length)],
                `削除フィールド数: ${result().removedKeys.length} 件`,
              )}
            </div>
            <Show when={result().removedKeys.length > 0}>
              <ul class="max-h-32 overflow-auto rounded border bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <For each={result().removedKeys}>{(key) => <li>{key}</li>}</For>
              </ul>
            </Show>
            <button
              type="button"
              onClick={handleDownload}
              class="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              {t('strip_button_download', undefined, 'ダウンロード')}
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}
