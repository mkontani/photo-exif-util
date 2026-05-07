import type { ExifCategory } from './types';

/**
 * キーのプレフィックスまたは完全一致でカテゴリを決定するテーブル。
 * 優先順位: プレフィックス一致 → 完全一致 → 'other'
 */
const PREFIX_MAP: ReadonlyArray<readonly [string, ExifCategory]> = [['GPS', 'gps']];

const EXACT_MAP: Readonly<Record<string, ExifCategory>> = {
  // デバイス系
  Make: 'device',
  Model: 'device',
  SerialNumber: 'device',
  BodySerialNumber: 'device',
  CameraSerialNumber: 'device',
  // レンズ系
  LensMake: 'lens',
  LensModel: 'lens',
  LensSerialNumber: 'lens',
  LensInfo: 'lens',
  LensSpecification: 'lens',
  // 撮影パラメータ系
  FNumber: 'capture',
  ExposureTime: 'capture',
  ISO: 'capture',
  ISOSpeedRatings: 'capture',
  FocalLength: 'capture',
  FocalLengthIn35mmFormat: 'capture',
  ShutterSpeedValue: 'capture',
  ApertureValue: 'capture',
  ExposureBiasValue: 'capture',
  Flash: 'capture',
  WhiteBalance: 'capture',
  MeteringMode: 'capture',
  ExposureMode: 'capture',
  ExposureProgram: 'capture',
  SceneCaptureType: 'capture',
  DigitalZoomRatio: 'capture',
  // 日時系
  DateTimeOriginal: 'datetime',
  CreateDate: 'datetime',
  ModifyDate: 'datetime',
  DateTime: 'datetime',
  DateTimeDigitized: 'datetime',
  SubSecTime: 'datetime',
  SubSecTimeOriginal: 'datetime',
  SubSecTimeDigitized: 'datetime',
  // ソフトウェア系
  Software: 'software',
  ProcessingSoftware: 'software',
  // 向き系
  Orientation: 'orientation',
};

/**
 * EXIF フィールドキーからカテゴリを返す。
 * 未知のキーは 'other' として扱う。
 */
export function categorize(key: string): ExifCategory {
  // プレフィックス一致 (例: "GPS" → 'gps')
  for (const [prefix, category] of PREFIX_MAP) {
    if (key.startsWith(prefix)) {
      return category;
    }
  }

  // 完全一致
  const exact = EXACT_MAP[key];
  if (exact !== undefined) {
    return exact;
  }

  return 'other';
}
