/**
 * JPEG EXIF strip エンジン。
 * piexifjs を使用して APP1 セグメントを操作する。
 */
import * as piexif from 'piexifjs';
import { arrayBufferToBinaryString, binaryStringToUint8Array } from '../../utils/blob';
import type { StripError, StripOptions } from './strip';
import type { ExifCategory } from './types';

/**
 * カテゴリから削除すべきタグのマッピング。
 * IFD 名と piexifjs のタグ番号の組で定義する。
 * orientation は画像表示に影響するため除外リストに含めない。
 * icc は JPEG では APP2 セグメントに存在するが piexifjs が管理しないため空。
 */
const CATEGORY_TO_TAGS: Readonly<
  Record<ExifCategory, ReadonlyArray<{ ifd: 'GPS' | 'Exif' | '0th'; tag: number }>>
> = {
  gps: [
    // GPS IFD の全タグ番号 (0-30) を列挙
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSVersionID },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSLatitudeRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSLatitude },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSLongitudeRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSLongitude },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSAltitudeRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSAltitude },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSTimeStamp },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSSatellites },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSStatus },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSMeasureMode },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDOP },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSSpeedRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSSpeed },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSTrackRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSTrack },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSImgDirectionRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSImgDirection },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSMapDatum },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestLatitudeRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestLatitude },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestLongitudeRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestLongitude },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestBearingRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestBearing },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestDistanceRef },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDestDistance },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSProcessingMethod },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSAreaInformation },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDateStamp },
    { ifd: 'GPS', tag: piexif.GPSIFD.GPSDifferential },
  ],
  device: [
    { ifd: '0th', tag: piexif.ImageIFD.Make },
    { ifd: '0th', tag: piexif.ImageIFD.Model },
    // BodySerialNumber (42033) は ExifIFD のタグ (EXIF 2.32 仕様)
    { ifd: 'Exif', tag: piexif.ExifIFD.BodySerialNumber },
  ],
  lens: [
    { ifd: 'Exif', tag: piexif.ExifIFD.LensMake },
    { ifd: 'Exif', tag: piexif.ExifIFD.LensModel },
    { ifd: 'Exif', tag: piexif.ExifIFD.LensSerialNumber },
    { ifd: 'Exif', tag: piexif.ExifIFD.LensSpecification },
  ],
  capture: [
    { ifd: 'Exif', tag: piexif.ExifIFD.FNumber },
    { ifd: 'Exif', tag: piexif.ExifIFD.ExposureTime },
    { ifd: 'Exif', tag: piexif.ExifIFD.ISOSpeedRatings },
    { ifd: 'Exif', tag: piexif.ExifIFD.FocalLength },
    { ifd: 'Exif', tag: piexif.ExifIFD.FocalLengthIn35mmFormat },
    { ifd: 'Exif', tag: piexif.ExifIFD.ShutterSpeedValue },
    { ifd: 'Exif', tag: piexif.ExifIFD.ApertureValue },
    { ifd: 'Exif', tag: piexif.ExifIFD.ExposureBiasValue },
    { ifd: 'Exif', tag: piexif.ExifIFD.Flash },
    { ifd: 'Exif', tag: piexif.ExifIFD.WhiteBalance },
    { ifd: 'Exif', tag: piexif.ExifIFD.MeteringMode },
    { ifd: 'Exif', tag: piexif.ExifIFD.ExposureMode },
    { ifd: 'Exif', tag: piexif.ExifIFD.SceneCaptureType },
    { ifd: 'Exif', tag: piexif.ExifIFD.DigitalZoomRatio },
  ],
  datetime: [
    { ifd: '0th', tag: piexif.ImageIFD.DateTime },
    { ifd: 'Exif', tag: piexif.ExifIFD.DateTimeOriginal },
    { ifd: 'Exif', tag: piexif.ExifIFD.DateTimeDigitized },
  ],
  software: [
    { ifd: '0th', tag: piexif.ImageIFD.Software },
    { ifd: '0th', tag: piexif.ImageIFD.ProcessingSoftware },
  ],
  // orientation は画像の表示方向に直結するため、明示的に削除対象から外す
  orientation: [],
  // other カテゴリはキーベースのマッピングがないため空 (全削除時は APP1 ごと削除)
  other: [],
} as const;

/**
 * タグ番号からフィールドキー名を逆引きするマップ。
 * removedKeys の生成に使用する。
 */
const TAG_TO_KEY: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  GPS: {
    [piexif.GPSIFD.GPSVersionID]: 'GPSVersionID',
    [piexif.GPSIFD.GPSLatitudeRef]: 'GPSLatitudeRef',
    [piexif.GPSIFD.GPSLatitude]: 'GPSLatitude',
    [piexif.GPSIFD.GPSLongitudeRef]: 'GPSLongitudeRef',
    [piexif.GPSIFD.GPSLongitude]: 'GPSLongitude',
    [piexif.GPSIFD.GPSAltitudeRef]: 'GPSAltitudeRef',
    [piexif.GPSIFD.GPSAltitude]: 'GPSAltitude',
    [piexif.GPSIFD.GPSTimeStamp]: 'GPSTimeStamp',
    [piexif.GPSIFD.GPSSatellites]: 'GPSSatellites',
    [piexif.GPSIFD.GPSStatus]: 'GPSStatus',
    [piexif.GPSIFD.GPSMeasureMode]: 'GPSMeasureMode',
    [piexif.GPSIFD.GPSDOP]: 'GPSDOP',
    [piexif.GPSIFD.GPSSpeedRef]: 'GPSSpeedRef',
    [piexif.GPSIFD.GPSSpeed]: 'GPSSpeed',
    [piexif.GPSIFD.GPSTrackRef]: 'GPSTrackRef',
    [piexif.GPSIFD.GPSTrack]: 'GPSTrack',
    [piexif.GPSIFD.GPSImgDirectionRef]: 'GPSImgDirectionRef',
    [piexif.GPSIFD.GPSImgDirection]: 'GPSImgDirection',
    [piexif.GPSIFD.GPSMapDatum]: 'GPSMapDatum',
    [piexif.GPSIFD.GPSDestLatitudeRef]: 'GPSDestLatitudeRef',
    [piexif.GPSIFD.GPSDestLatitude]: 'GPSDestLatitude',
    [piexif.GPSIFD.GPSDestLongitudeRef]: 'GPSDestLongitudeRef',
    [piexif.GPSIFD.GPSDestLongitude]: 'GPSDestLongitude',
    [piexif.GPSIFD.GPSDestBearingRef]: 'GPSDestBearingRef',
    [piexif.GPSIFD.GPSDestBearing]: 'GPSDestBearing',
    [piexif.GPSIFD.GPSDestDistanceRef]: 'GPSDestDistanceRef',
    [piexif.GPSIFD.GPSDestDistance]: 'GPSDestDistance',
    [piexif.GPSIFD.GPSProcessingMethod]: 'GPSProcessingMethod',
    [piexif.GPSIFD.GPSAreaInformation]: 'GPSAreaInformation',
    [piexif.GPSIFD.GPSDateStamp]: 'GPSDateStamp',
    [piexif.GPSIFD.GPSDifferential]: 'GPSDifferential',
  },
  Exif: {
    [piexif.ExifIFD.ExposureTime]: 'ExposureTime',
    [piexif.ExifIFD.FNumber]: 'FNumber',
    [piexif.ExifIFD.ISOSpeedRatings]: 'ISOSpeedRatings',
    [piexif.ExifIFD.DateTimeOriginal]: 'DateTimeOriginal',
    [piexif.ExifIFD.DateTimeDigitized]: 'DateTimeDigitized',
    [piexif.ExifIFD.ShutterSpeedValue]: 'ShutterSpeedValue',
    [piexif.ExifIFD.ApertureValue]: 'ApertureValue',
    [piexif.ExifIFD.ExposureBiasValue]: 'ExposureBiasValue',
    [piexif.ExifIFD.MeteringMode]: 'MeteringMode',
    [piexif.ExifIFD.Flash]: 'Flash',
    [piexif.ExifIFD.FocalLength]: 'FocalLength',
    [piexif.ExifIFD.FocalLengthIn35mmFormat]: 'FocalLengthIn35mmFormat',
    [piexif.ExifIFD.ExposureMode]: 'ExposureMode',
    [piexif.ExifIFD.WhiteBalance]: 'WhiteBalance',
    [piexif.ExifIFD.SceneCaptureType]: 'SceneCaptureType',
    [piexif.ExifIFD.DigitalZoomRatio]: 'DigitalZoomRatio',
    [piexif.ExifIFD.BodySerialNumber]: 'BodySerialNumber',
    [piexif.ExifIFD.LensMake]: 'LensMake',
    [piexif.ExifIFD.LensModel]: 'LensModel',
    [piexif.ExifIFD.LensSerialNumber]: 'LensSerialNumber',
    [piexif.ExifIFD.LensSpecification]: 'LensSpecification',
  },
  '0th': {
    [piexif.ImageIFD.Make]: 'Make',
    [piexif.ImageIFD.Model]: 'Model',
    [piexif.ImageIFD.Orientation]: 'Orientation',
    [piexif.ImageIFD.DateTime]: 'DateTime',
    [piexif.ImageIFD.Software]: 'Software',
    [piexif.ImageIFD.ProcessingSoftware]: 'ProcessingSoftware',
  },
};

/** ExifCategory のセットに対して、削除すべきタグセットを計算する */
function buildRemoveTagSet(
  categoriesToRemove: ReadonlySet<ExifCategory>,
): ReadonlyArray<{ ifd: 'GPS' | 'Exif' | '0th'; tag: number }> {
  const tags: Array<{ ifd: 'GPS' | 'Exif' | '0th'; tag: number }> = [];
  for (const category of categoriesToRemove) {
    const categoryTags = CATEGORY_TO_TAGS[category];
    if (categoryTags !== undefined) {
      tags.push(...categoryTags);
    }
  }
  return tags;
}

/** ExifDict から指定タグを削除し、削除されたキーを返す */
function deleteTagsFromDict(
  exifDict: ReturnType<typeof piexif.load>,
  tagsToRemove: ReadonlyArray<{ ifd: 'GPS' | 'Exif' | '0th'; tag: number }>,
): readonly string[] {
  const removedKeys: string[] = [];
  for (const { ifd, tag } of tagsToRemove) {
    const ifdData = exifDict[ifd];
    if (tag in ifdData) {
      const keyName = TAG_TO_KEY[ifd]?.[tag] ?? `${ifd}_${tag}`;
      removedKeys.push(keyName);
      // piexifjs の ExifDict は通常 mutable オブジェクトとして操作する
      // ここでは piexifjs の内部仕様に従い delete を使用
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (ifdData as Record<number, unknown>)[tag];
    }
  }
  return removedKeys;
}

export interface JpegStripResult {
  readonly blob: Blob;
  readonly removedKeys: readonly string[];
  readonly format: 'jpeg';
}

/**
 * JPEG Blob から指定カテゴリの EXIF を削除する。
 * piexifjs を使って APP1 セグメントを操作する。
 *
 * @param blob - 入力 JPEG Blob
 * @param options - StripOptions (remove/keep)
 * @returns 削除後の JPEG Blob と削除キー一覧
 */
export async function stripJpeg(blob: Blob, options: StripOptions = {}): Promise<JpegStripResult> {
  const buffer = await blob.arrayBuffer();
  const binaryStr = arrayBufferToBinaryString(buffer);

  // EXIF データが存在しない場合でも piexifjs は空の辞書を返す
  let exifDict: ReturnType<typeof piexif.load>;
  try {
    exifDict = piexif.load(binaryStr);
  } catch {
    // EXIF セグメントがない、または解析失敗 → APP1 削除のみ試みる。
    // piexif.remove() も throw する場合 (例: JPEG 構造そのものが壊れている) は
    // StripError として正規化し、内部実装メッセージの漏洩を防ぐ。
    try {
      const stripped = piexif.remove(binaryStr);
      const resultBytes = binaryStringToUint8Array(stripped);
      return {
        blob: new Blob([resultBytes], { type: 'image/jpeg' }),
        removedKeys: [],
        format: 'jpeg',
      };
    } catch {
      const err: StripError = {
        code: 'STRIP_ERROR',
        message: 'Failed to strip JPEG: corrupted structure',
      };
      throw err;
    }
  }

  const { remove, keep } = options;

  // 全削除モード
  if (remove === 'all') {
    // piexifjs の remove() で APP1 セグメントごと削除する
    const allRemovedKeys = collectExistingKeys(exifDict);
    const stripped = piexif.remove(binaryStr);
    const resultBytes = binaryStringToUint8Array(stripped);
    return {
      blob: new Blob([resultBytes], { type: 'image/jpeg' }),
      removedKeys: allRemovedKeys,
      format: 'jpeg',
    };
  }

  // keep モード: 保持するカテゴリを除く全カテゴリを削除
  // remove モード: 指定カテゴリを削除
  const categoriesToRemove = buildCategoriesToRemove(remove, keep);
  const tagsToRemove = buildRemoveTagSet(categoriesToRemove);
  const removedKeys = deleteTagsFromDict(exifDict, tagsToRemove);

  // 変更後の exifDict を JPEG に書き戻す
  const modifiedJpeg = piexif.insert(piexif.dump(exifDict), piexif.remove(binaryStr));
  const resultBytes = binaryStringToUint8Array(modifiedJpeg);

  return {
    blob: new Blob([resultBytes], { type: 'image/jpeg' }),
    removedKeys,
    format: 'jpeg',
  };
}

/**
 * 削除すべきカテゴリのセットを計算する。
 * keep が指定された場合: 全カテゴリから keep を除く
 * remove が指定された場合: 指定カテゴリのみ
 * 未指定の場合: 全カテゴリ
 */
function buildCategoriesToRemove(
  remove: StripOptions['remove'],
  keep: StripOptions['keep'],
): ReadonlySet<ExifCategory> {
  // icc は CATEGORY_TO_TAGS に含まれないため、ExifCategory に絞り込む
  const allCategories: readonly ExifCategory[] = [
    'gps',
    'device',
    'lens',
    'capture',
    'datetime',
    'software',
    'other',
  ];

  if (keep !== undefined) {
    const keepSet = new Set(keep);
    return new Set(allCategories.filter((c) => !keepSet.has(c)));
  }

  if (remove !== undefined && remove !== 'all') {
    // StripCategory から ExifCategory のみをフィルタリング
    const exifCategories = (remove as readonly string[]).filter(
      (c): c is ExifCategory => c !== 'icc',
    );
    return new Set(exifCategories);
  }

  // デフォルト: 全カテゴリ (remove: 'all' と同じ)
  return new Set(allCategories);
}

/**
 * ExifDict に存在する全フィールドキーを収集する。
 * 全削除時の removedKeys 生成に使用。
 */
function collectExistingKeys(exifDict: ReturnType<typeof piexif.load>): readonly string[] {
  const keys: string[] = [];

  for (const [ifdName, tagMap] of [
    ['GPS', TAG_TO_KEY.GPS],
    ['Exif', TAG_TO_KEY.Exif],
    ['0th', TAG_TO_KEY['0th']],
  ] as const) {
    const ifdData = exifDict[ifdName];
    if (tagMap === undefined) continue;
    for (const [tagStr, keyName] of Object.entries(tagMap)) {
      const tag = Number(tagStr);
      if (tag in ifdData) {
        keys.push(keyName);
      }
    }
  }

  return keys;
}
