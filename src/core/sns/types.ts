/**
 * SNS 最適化エンジン共通型定義。
 * 純粋なデータ型のみを定義し、ロジックは含まない。
 */
import type { StripCategory, StripOptions } from '@/core/exif/strip';

/** 出力フォーマット */
export type OutputFormat = 'jpeg' | 'webp';

/** リサイズモード */
export type FitMode = 'fit' | 'cover' | 'pad';
// fit:   アスペクト維持で最大寸法に収める (画像全体表示、余白なし)
// cover: アスペクト維持で寸法を満たし、はみ出した部分はクロップ
// pad:   アスペクト維持で fit させ、余白を背景色で埋める

/** SNS プロファイル */
export interface SnsProfile {
  readonly id: string;
  /** 表示用ラベル (i18n キー想定) */
  readonly label: string;
  /** 推奨最大幅 (px) */
  readonly maxWidth: number;
  /** 推奨最大高さ (px) */
  readonly maxHeight: number;
  /** アスペクト比 (オプション、cover/pad モード用) */
  readonly aspectRatio?: { readonly w: number; readonly h: number; readonly mode: FitMode };
  /** ファイルサイズ目標 (KB)。未指定なら品質固定。 */
  readonly maxFileSizeKB?: number;
  /** 出力フォーマット (推奨) */
  readonly preferredFormat: OutputFormat;
  /** デフォルト品質 (0-100) */
  readonly defaultQuality: number;
  /** EXIF を必ず削除するか */
  readonly stripExif: boolean;
  /** デフォルト strip カテゴリ (stripExif=true 時に適用) */
  readonly defaultStripCategories?: 'all' | readonly StripCategory[];
}

/** apply 結果 */
export interface SnsApplyResult {
  readonly blob: Blob;
  readonly outputDimensions: { readonly width: number; readonly height: number };
  readonly outputFormat: OutputFormat;
  readonly outputSizeBytes: number;
  readonly quality: number;
  readonly profileId: string;
  /** strip した場合の削除キー一覧 */
  readonly removedExifKeys: readonly string[];
  /**
   * `profile.maxFileSizeKB` 指定時にバイナリサーチが target 内に収束したか。
   * 未指定の場合は常に `true` (size 目標なし)。
   * `false` の場合 UI で「目標サイズに収まらなかった」を警告表示する想定。
   */
  readonly sizeTargetReached: boolean;
}

/** apply エラー */
export type SnsApplyError =
  | { readonly code: 'DECODE_FAILED'; readonly message: string }
  | { readonly code: 'RESIZE_FAILED'; readonly message: string }
  | { readonly code: 'ENCODE_FAILED'; readonly message: string }
  | {
      readonly code: 'SIZE_TARGET_UNREACHABLE';
      readonly message: string;
      readonly bestSize: number;
    }
  | { readonly code: 'INVALID_PROFILE'; readonly message: string };

/**
 * StripOptions を再エクスポート。
 * SNS API 利用者が `@/core/sns` だけを import すれば strip オプションも扱えるようにする
 * (Phase 5 UI 層の import を簡潔化する目的)。
 */
export type { StripOptions };
