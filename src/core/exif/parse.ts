import { detectImageFormat } from '@/utils/detect-format';
import * as exifr from 'exifr';
import { categorize } from './categories';
import { riskOfField, summaryRisk } from './risk';
import type { ExifField, ExifParseError, ExifSummary, RiskLevel } from './types';

/**
 * parseExif が受け付ける Blob のサイズ上限 (バイト)。
 * 50MB を超える入力は exifr が ArrayBuffer 全体をメモリ展開するため、
 * 拡張のサービスワーカー / Offscreen Document で OOM を引き起こす可能性が高い。
 * UI 側でも同じ上限値をユーザー向けに表示できるよう named export している。
 */
export const MAX_BLOB_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * GPS 度分秒を十進数度に変換して文字列表示値を返す。
 * exifr は GPS を [degrees, minutes, seconds] の配列、または十進数で返す場合がある。
 */
function formatGpsValue(value: unknown): string {
  if (Array.isArray(value) && value.length === 3) {
    const [deg, min, sec] = value as [number, number, number];
    return `${deg}°${min}'${sec.toFixed(2)}"`;
  }
  if (typeof value === 'number') {
    return value.toFixed(6);
  }
  return String(value);
}

/**
 * 日時値を ISO 8601 形式に変換する。
 * exifr は Date オブジェクト、または "YYYY:MM:DD HH:MM:SS" 文字列を返す。
 */
function formatDateTimeValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    // "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"
    // 日付部分のコロン→ハイフン、日付と時刻の区切り空白→T を 1 操作で実施
    return value.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
  }
  return String(value);
}

/**
 * EXIF フィールド値を人間が読みやすい文字列に変換する。
 */
function formatDisplayValue(key: string, value: unknown, category: ExifField['category']): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (category === 'gps' && (key === 'GPSLatitude' || key === 'GPSLongitude')) {
    return formatGpsValue(value);
  }

  if (category === 'datetime') {
    return formatDateTimeValue(value);
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  /* c8 ignore start -- 大きな binary は flattenToFields で 512 byte 超を弾くため通常到達せず */
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return `[binary ${value instanceof Uint8Array ? value.length : (value as ArrayBuffer).byteLength} bytes]`;
  }
  /* c8 ignore stop */

  return String(value);
}

/**
 * exifr がパースしたフラットなオブジェクトを ExifField[] に変換する。
 */
function flattenToFields(parsed: Record<string, unknown>): readonly ExifField[] {
  const fields: ExifField[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined || value === null) continue;

    // バイナリ系の大きなフィールドはスキップ (MakerNote, ICC profile 等)
    if (value instanceof Uint8Array && value.length > 512) continue;
    if (value instanceof ArrayBuffer && value.byteLength > 512) continue;

    const category = categorize(key);
    const risk = riskOfField({ category, key });
    const displayValue = formatDisplayValue(key, value, category);

    fields.push({
      key,
      category,
      risk,
      displayValue,
      rawValue: value,
    });
  }

  return fields;
}

/**
 * Blob から EXIF メタデータを解析して ExifSummary を返す。
 * パースに失敗した場合は ExifParseError を reject する。
 */
export async function parseExif(blob: Blob): Promise<ExifSummary> {
  // 空の入力チェック
  if (blob.size === 0) {
    const err: ExifParseError = {
      code: 'EMPTY_INPUT',
      message: 'Input blob is empty',
    };
    return Promise.reject(err);
  }

  // サイズ上限チェック (DoS 対策: 巨大画像でメモリ枯渇を防ぐ)
  if (blob.size > MAX_BLOB_SIZE_BYTES) {
    const err: ExifParseError = {
      code: 'TOO_LARGE',
      message: `Input blob exceeds maximum size: ${blob.size} > ${MAX_BLOB_SIZE_BYTES} bytes`,
    };
    return Promise.reject(err);
  }

  // フォーマット判定
  const format = await detectImageFormat(blob);

  // exifr でパース
  let parsed: Record<string, unknown> | undefined;
  let parseError: unknown = undefined;
  try {
    // exifr の Options 型は ifd0/ifd1 に FormatOptions を期待するが、
    // boolean も受け付ける実装になっているため unknown でキャスト
    // TODO(Phase 2): mergeOutput: true はセグメント間の同名キーを後勝ちでマージする。
    // strip 実装ではセグメント別に処理する必要があるため mergeOutput: false に切り替える。
    parsed = (await (exifr.parse as (input: unknown, options: unknown) => Promise<unknown>)(blob, {
      mergeOutput: true,
      gps: true,
      exif: true,
      iptc: false,
      xmp: false,
      icc: false,
      ifd0: true,
      ifd1: false,
      makerNote: false,
      translateValues: true,
      reviveValues: true,
    })) as Record<string, unknown> | undefined;
  } catch (cause) {
    parseError = cause;
  }

  // フォーマットが既知の場合 (jpeg/png/webp) はパースエラーを「EXIF なし」として扱う。
  // 例: WebP の VP8L ビットストリームが exifr の内部バリデーションを通過しなくても、
  // フォーマット判定はマジックバイトで正確に行えるため問題ない。
  if (parseError !== undefined) {
    if (format === 'jpeg' || format === 'png' || format === 'webp') {
      // EXIF セグメントが存在しないか解析できない場合は空フィールドとして扱う
      return {
        format,
        fields: [],
        hasGps: false,
        highestRisk: 'none',
      };
    }
    // unknown format のパースエラーは PARSE_ERROR として報告
    const err: ExifParseError = {
      code: 'PARSE_ERROR',
      message: parseError instanceof Error ? parseError.message : String(parseError),
    };
    return Promise.reject(err);
  }

  // exifr が undefined/null を返す場合も EXIF なしとして扱う
  if (parsed === undefined || parsed === null) {
    // EXIF なし画像は正常ケース
    if (format === 'jpeg' || format === 'png' || format === 'webp') {
      return {
        format,
        fields: [],
        hasGps: false,
        highestRisk: 'none',
      };
    }
    /* c8 ignore start -- unknown format で exifr が throw せず undefined を返す経路は exifr 7.x では発生しないが防御的に保持 */
    const err: ExifParseError = {
      code: 'PARSE_ERROR',
      message: 'Failed to parse image: unknown format or corrupted data',
    };
    return Promise.reject(err);
    /* c8 ignore stop */
  }

  const fields = flattenToFields(parsed);
  const risks: readonly RiskLevel[] = fields.map((f) => f.risk);
  const highestRisk = summaryRisk(risks);
  const hasGps = fields.some((f) => f.category === 'gps');

  return {
    format,
    fields,
    hasGps,
    highestRisk,
  };
}
