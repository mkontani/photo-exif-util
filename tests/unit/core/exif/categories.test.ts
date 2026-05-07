import { categorize } from '@/core/exif/categories';
import { describe, expect, it } from 'vitest';

describe('categorize', () => {
  it.each([
    // GPS 系
    ['GPSLatitude', 'gps'],
    ['GPSLongitude', 'gps'],
    ['GPSAltitude', 'gps'],
    ['GPSLatitudeRef', 'gps'],
    ['GPSLongitudeRef', 'gps'],
    ['GPSDateStamp', 'gps'],
    ['GPSTimeStamp', 'gps'],
    // デバイス系
    ['Make', 'device'],
    ['Model', 'device'],
    ['SerialNumber', 'device'],
    ['BodySerialNumber', 'device'],
    ['CameraSerialNumber', 'device'],
    // レンズ系
    ['LensMake', 'lens'],
    ['LensModel', 'lens'],
    ['LensSerialNumber', 'lens'],
    ['LensInfo', 'lens'],
    // 撮影パラメータ系
    ['FNumber', 'capture'],
    ['ExposureTime', 'capture'],
    ['ISO', 'capture'],
    ['FocalLength', 'capture'],
    ['ShutterSpeedValue', 'capture'],
    ['ApertureValue', 'capture'],
    ['ExposureBiasValue', 'capture'],
    ['Flash', 'capture'],
    ['WhiteBalance', 'capture'],
    // 日時系
    ['DateTimeOriginal', 'datetime'],
    ['CreateDate', 'datetime'],
    ['ModifyDate', 'datetime'],
    ['DateTime', 'datetime'],
    ['DateTimeDigitized', 'datetime'],
    // ソフトウェア系
    ['Software', 'software'],
    ['ProcessingSoftware', 'software'],
    // 向き系
    ['Orientation', 'orientation'],
    // その他 (マッチしないキー)
    ['UnknownTagXYZ', 'other'],
    ['', 'other'],
    ['XMPCustomField', 'other'],
  ] as const)('categorize(%s) === %s', (key, expected) => {
    expect(categorize(key)).toBe(expected);
  });
});
