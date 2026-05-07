/**
 * piexifjs の型定義。
 * 公式型定義が薄いため、使用する API のみ手動で定義する。
 */
declare module 'piexifjs' {
  /**
   * EXIF データの辞書型。
   * piexifjs は IFD をキーとし、タグ番号 → 値のマップを値として持つ。
   */
  export interface ExifDict {
    readonly '0th': Record<number, unknown>;
    readonly Exif: Record<number, unknown>;
    readonly GPS: Record<number, unknown>;
    readonly Interop: Record<number, unknown>;
    readonly '1st': Record<number, unknown>;
    readonly thumbnail: string | null;
  }

  /**
   * JPEG から EXIF APP1 セグメントを削除する。
   * @param jpeg - binary string または data:image/jpeg;base64,... 形式
   * @returns 入力と同じ形式で EXIF を除いた JPEG
   */
  export function remove(jpeg: string): string;

  /**
   * JPEG から EXIF データを読み込んで辞書として返す。
   * @param data - binary string または data:image/jpeg;base64,... 形式
   */
  export function load(data: string): ExifDict;

  /**
   * EXIF 辞書をバイナリ文字列 (APP1 ペイロード) にシリアライズする。
   * 結果は "Exif\0\0" ヘッダーを含む形式。
   */
  export function dump(exifDict: Partial<ExifDict>): string;

  /**
   * JPEG に EXIF データを挿入する。
   * @param exif - dump() の戻り値
   * @param jpeg - binary string または data:image/jpeg;base64,... 形式
   */
  export function insert(exif: string, jpeg: string): string;

  /** ImageIFD (0th IFD) のタグ番号定数 */
  export const ImageIFD: {
    readonly ProcessingSoftware: 11;
    readonly ImageWidth: 256;
    readonly ImageLength: 257;
    readonly BitsPerSample: 258;
    readonly Make: 271;
    readonly Model: 272;
    readonly Orientation: 274;
    readonly XResolution: 282;
    readonly YResolution: 283;
    readonly ResolutionUnit: 296;
    readonly Software: 305;
    readonly DateTime: 306;
    readonly Artist: 315;
    readonly ExifTag: 34665;
    readonly GPSTag: 34853;
    [key: string]: number;
  };

  /** ExifIFD のタグ番号定数 */
  export const ExifIFD: {
    readonly ExposureTime: 33434;
    readonly FNumber: 33437;
    readonly ISOSpeedRatings: 34855;
    readonly DateTimeOriginal: 36867;
    readonly DateTimeDigitized: 36868;
    readonly ShutterSpeedValue: 37377;
    readonly ApertureValue: 37378;
    readonly ExposureBiasValue: 37380;
    readonly MeteringMode: 37383;
    readonly Flash: 37385;
    readonly FocalLength: 37386;
    readonly FocalLengthIn35mmFormat: 41989;
    readonly ExposureMode: 41986;
    readonly WhiteBalance: 41987;
    readonly DigitalZoomRatio: 41988;
    readonly SceneCaptureType: 41990;
    readonly BodySerialNumber: 42033;
    readonly LensMake: 42035;
    readonly LensModel: 42036;
    readonly LensSerialNumber: 42037;
    readonly LensSpecification: 42034;
    readonly InteroperabilityTag: 40965;
    [key: string]: number;
  };

  /** GPSIFD のタグ番号定数 */
  export const GPSIFD: {
    readonly GPSVersionID: 0;
    readonly GPSLatitudeRef: 1;
    readonly GPSLatitude: 2;
    readonly GPSLongitudeRef: 3;
    readonly GPSLongitude: 4;
    readonly GPSAltitudeRef: 5;
    readonly GPSAltitude: 6;
    readonly GPSTimeStamp: 7;
    readonly GPSSatellites: 8;
    readonly GPSStatus: 9;
    readonly GPSMeasureMode: 10;
    readonly GPSDOP: 11;
    readonly GPSSpeedRef: 12;
    readonly GPSSpeed: 13;
    readonly GPSTrackRef: 14;
    readonly GPSTrack: 15;
    readonly GPSImgDirectionRef: 16;
    readonly GPSImgDirection: 17;
    readonly GPSMapDatum: 18;
    readonly GPSDestLatitudeRef: 19;
    readonly GPSDestLatitude: 20;
    readonly GPSDestLongitudeRef: 21;
    readonly GPSDestLongitude: 22;
    readonly GPSDestBearingRef: 23;
    readonly GPSDestBearing: 24;
    readonly GPSDestDistanceRef: 25;
    readonly GPSDestDistance: 26;
    readonly GPSProcessingMethod: 27;
    readonly GPSAreaInformation: 28;
    readonly GPSDateStamp: 29;
    readonly GPSDifferential: 30;
    [key: string]: number;
  };
}
