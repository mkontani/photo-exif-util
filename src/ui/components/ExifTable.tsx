import type { ExifSummary } from '@/core/exif/types';
import { filterFields } from '@/state/inspect-store';
import { t } from '@/ui/i18n/t';
/**
 * EXIF フィールド一覧を表示するテーブルコンポーネント。
 * 検索ボックスとカテゴリフィルタで絞り込み可能。
 */
import { For, Show, createSignal } from 'solid-js';
import { RiskBadge } from './RiskBadge';

interface ExifTableProps {
  summary: ExifSummary;
}

/** フィルタ対象のカテゴリ一覧 (ExifCategory + 'all') */
const CATEGORIES = [
  'all',
  'gps',
  'device',
  'lens',
  'capture',
  'datetime',
  'software',
  'orientation',
  'other',
] as const;

export function ExifTable(props: ExifTableProps) {
  const [query, setQuery] = createSignal('');
  const [category, setCategory] = createSignal<string>('all');

  const filtered = () =>
    filterFields(props.summary.fields, { query: query(), category: category() });

  return (
    <div class="flex flex-col gap-2">
      {/* 検索ボックス: type=search は searchbox role を暗黙に持つので role 属性は不要 */}
      <input
        type="search"
        aria-label={t('exiftable_search_aria', undefined, 'EXIF フィールドを検索')}
        placeholder={t('exiftable_search_placeholder', undefined, 'フィールド名で検索...')}
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        class="rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
      />

      {/* カテゴリフィルタ: fieldset で a11y グルーピング */}
      <fieldset class="flex flex-wrap gap-1 border-0 p-0">
        <legend class="sr-only">
          {t('exiftable_filter_legend', undefined, 'カテゴリ絞り込み')}
        </legend>
        <For each={CATEGORIES}>
          {(cat) => (
            <button
              type="button"
              aria-pressed={category() === cat}
              onClick={() => setCategory(cat)}
              class={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                category() === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          )}
        </For>
      </fieldset>

      {/* フィールド数 0 (初期状態) */}
      <Show when={props.summary.fields.length === 0}>
        <p class="py-8 text-center text-sm text-gray-500">
          {t('exiftable_no_data', undefined, 'EXIF データなし')}
        </p>
      </Show>

      {/* 検索結果 0 (フィルタ後) */}
      <Show when={props.summary.fields.length > 0 && filtered().length === 0}>
        <p class="py-4 text-center text-sm text-gray-500">
          {t('exiftable_no_match', undefined, '該当なし')}
        </p>
      </Show>

      {/* フィールドテーブル */}
      <Show when={filtered().length > 0}>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-xs text-gray-500">
                <th scope="col" class="pb-1 pr-3 font-medium">
                  {t('exiftable_header_key', undefined, 'キー')}
                </th>
                <th scope="col" class="pb-1 pr-3 font-medium">
                  {t('exiftable_header_value', undefined, '値')}
                </th>
                <th scope="col" class="pb-1 pr-3 font-medium">
                  {t('exiftable_header_category', undefined, 'カテゴリ')}
                </th>
                <th scope="col" class="pb-1 font-medium">
                  {t('exiftable_header_risk', undefined, 'リスク')}
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={filtered()}>
                {(field) => (
                  <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-1.5 pr-3 font-mono text-xs">{field.key}</td>
                    <td class="max-w-[160px] truncate py-1.5 pr-3 text-xs">{field.displayValue}</td>
                    <td class="py-1.5 pr-3 text-xs text-gray-500">{field.category}</td>
                    <td class="py-1.5">
                      <RiskBadge level={field.risk} />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}
