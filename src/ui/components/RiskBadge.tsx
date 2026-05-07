import type { RiskLevel } from '@/core/exif/types';
/**
 * リスクレベルを色付きバッジで視覚的に表示するコンポーネント。
 * a11y のため aria-label でリスクレベルを明示する。
 * aria-label は riskbadge_aria i18n キー経由で取得し、多言語対応する。
 */
import { clsx } from 'clsx';
import { t } from '../i18n/t';

interface RiskBadgeProps {
  level: RiskLevel;
  class?: string;
}

/** リスクレベルに対応する i18n キーと Tailwind クラス */
const LEVEL_CONFIG: Record<RiskLevel, { readonly classes: string; readonly labelKey: string }> = {
  high: { classes: 'bg-red-100 text-red-800', labelKey: 'risk_high' },
  medium: { classes: 'bg-amber-100 text-amber-800', labelKey: 'risk_medium' },
  low: { classes: 'bg-blue-100 text-blue-800', labelKey: 'risk_low' },
  none: { classes: 'bg-gray-100 text-gray-700', labelKey: 'risk_none' },
};

export function RiskBadge(props: RiskBadgeProps) {
  const config = () => LEVEL_CONFIG[props.level];

  // i18n キーから表示ラベルを取得する (High / Medium / Low / None など)
  const labelText = () =>
    t(config().labelKey, undefined, props.level.charAt(0).toUpperCase() + props.level.slice(1));

  // aria-label は riskbadge_aria キーに labelText を置換して生成する
  const ariaLabel = () => t('riskbadge_aria', [labelText()], `Risk level: ${labelText()}`);

  return (
    <span
      aria-label={ariaLabel()}
      class={clsx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        config().classes,
        props.class,
      )}
    >
      {labelText()}
    </span>
  );
}
