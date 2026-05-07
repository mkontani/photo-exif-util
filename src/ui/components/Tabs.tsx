/**
 * シンプルなタブ UI コンポーネント。
 * Kobalte の Tabs を使うのが理想だが、Phase 5b では SolidJS だけで最小実装する。
 * WAI-ARIA タブパターン準拠:
 *   - role="tablist" / role="tab" / aria-selected
 *   - roving tabindex (active のみ tabindex=0、それ以外は -1)
 *   - ArrowLeft/Right でタブ切替 + フォーカス移動
 *   - disabled タブは aria-disabled + tabindex=-1 で操作不可
 */
import { For } from 'solid-js';

export interface Tab {
  readonly id: string;
  readonly label: string;
  /** disabled なタブはクリック・キーボード操作を無視する */
  readonly disabled?: boolean;
}

interface TabsProps {
  readonly tabs: readonly Tab[];
  readonly active: string;
  readonly onChange: (id: string) => void;
}

export function Tabs(props: TabsProps) {
  /** 指定方向の次の有効 (非 disabled) タブインデックスを取得 */
  function findEnabledTab(start: number, direction: 1 | -1): number | undefined {
    const len = props.tabs.length;
    for (let step = 1; step <= len; step++) {
      const idx = (start + direction * step + len * len) % len;
      const candidate = props.tabs[idx];
      if (candidate && !candidate.disabled) return idx;
    }
    return undefined;
  }

  function handleKeyDown(e: KeyboardEvent, currentId: string) {
    const currentIndex = props.tabs.findIndex((t) => t.id === currentId);
    if (currentIndex === -1) return;

    let nextIndex: number | undefined;
    if (e.key === 'ArrowRight') {
      nextIndex = findEnabledTab(currentIndex, 1);
    } else if (e.key === 'ArrowLeft') {
      nextIndex = findEnabledTab(currentIndex, -1);
    }

    if (nextIndex === undefined) return;
    const nextTab = props.tabs[nextIndex];
    if (!nextTab) return;

    e.preventDefault();
    props.onChange(nextTab.id);
    // フォーカスを次タブに移動 (roving tabindex の挙動に合わせる)
    const next = e.currentTarget instanceof HTMLElement ? e.currentTarget.parentElement : null;
    const nextEl = next?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
    nextEl?.focus();
  }

  return (
    <div role="tablist" class="flex border-b">
      <For each={props.tabs}>
        {(tab) => {
          const isActive = () => props.active === tab.id;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={isActive() ? 'true' : 'false'}
              aria-disabled={tab.disabled ? 'true' : 'false'}
              tabIndex={isActive() ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => {
                if (tab.disabled) return;
                props.onChange(tab.id);
              }}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              class={`px-4 py-2 text-sm font-medium transition-colors ${
                isActive()
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {tab.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}
