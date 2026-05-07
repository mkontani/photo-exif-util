/** EXIF フィールドのカテゴリ分類 */
export type ExifCategory =
  | 'gps'
  | 'device'
  | 'lens'
  | 'capture'
  | 'datetime'
  | 'software'
  | 'orientation'
  | 'other';

/** プライバシーリスクレベル */
export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

/** 対応画像フォーマット */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'unknown';

/** 個々の EXIF フィールド */
export interface ExifField {
  readonly key: string;
  readonly category: ExifCategory;
  readonly risk: RiskLevel;
  /** 人間が読みやすい表示値 */
  readonly displayValue: string;
  /** 生の値 (数値・文字列・配列など) */
  readonly rawValue: unknown;
}

/** 画像全体の EXIF 解析結果サマリー */
export interface ExifSummary {
  readonly format: ImageFormat;
  readonly fields: readonly ExifField[];
  readonly hasGps: boolean;
  readonly highestRisk: RiskLevel;
}

/** parse 失敗時のエラー */
export interface ExifParseError {
  readonly code: 'PARSE_ERROR' | 'EMPTY_INPUT' | 'TOO_LARGE';
  readonly message: string;
}
