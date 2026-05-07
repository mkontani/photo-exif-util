import type { ExifField, RiskLevel } from './types';

/**
 * high リスクと判定するシリアル番号系フィールドキーのセット。
 * GPS は常に high、シリアル番号も個体識別可能なため high。
 */
const HIGH_RISK_KEYS: ReadonlySet<string> = new Set([
  'SerialNumber',
  'BodySerialNumber',
  'CameraSerialNumber',
  'LensSerialNumber',
]);

/**
 * カテゴリデフォルトのリスクレベルマップ。
 * キーで上書きされる場合はキーが優先される。
 */
const CATEGORY_DEFAULT_RISK: Readonly<Record<ExifField['category'], RiskLevel>> = {
  gps: 'high',
  device: 'medium',
  lens: 'low',
  capture: 'low',
  datetime: 'medium',
  software: 'low',
  orientation: 'low',
  other: 'low',
};

/**
 * 単一 EXIF フィールドのリスクレベルを返す。
 * GPS は無条件 high、特定のシリアル番号キーも high。
 * それ以外はカテゴリのデフォルト値を返す。
 */
export function riskOfField(field: Pick<ExifField, 'category' | 'key'>): RiskLevel {
  // GPS は常に high
  if (field.category === 'gps') {
    return 'high';
  }

  // シリアル番号系は高個体識別リスク
  if (HIGH_RISK_KEYS.has(field.key)) {
    return 'high';
  }

  return CATEGORY_DEFAULT_RISK[field.category];
}

/**
 * リスクレベルの順序 (大きいほど高リスク)
 */
const RISK_ORDER: Readonly<Record<RiskLevel, number>> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * 複数のリスクレベルから最高値を返す。
 * 空配列のとき 'none' を返す。
 */
export function summaryRisk(risks: readonly RiskLevel[]): RiskLevel {
  if (risks.length === 0) {
    return 'none';
  }

  return risks.reduce<RiskLevel>((highest, current) => {
    return RISK_ORDER[current] > RISK_ORDER[highest] ? current : highest;
  }, 'none');
}
