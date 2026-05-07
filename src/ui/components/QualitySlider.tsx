/**
 * 品質スライダーコンポーネント。
 * <input type="range"> ベースで現在値を横に表示する。
 */

interface QualitySliderProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  /** デフォルトは 0 (Phase 3 quality-search の minQuality と整合) */
  readonly min?: number;
  readonly max?: number;
  /** スクリーンリーダー向けラベル (省略時は "品質") */
  readonly label?: string;
}

export function QualitySlider(props: QualitySliderProps) {
  const min = () => props.min ?? 0;
  const max = () => props.max ?? 100;
  const label = () => props.label ?? '品質';

  function handleInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    props.onChange(Number(input.value));
  }

  return (
    <div class="flex items-center gap-3">
      <input
        type="range"
        min={min()}
        max={max()}
        value={props.value}
        aria-label={label()}
        aria-valuetext={`${props.value}%`}
        onInput={handleInput}
        class="flex-1 cursor-pointer accent-blue-500"
      />
      <span class="w-8 text-right text-sm tabular-nums">{props.value}</span>
    </div>
  );
}
