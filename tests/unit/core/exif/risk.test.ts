import { riskOfField, summaryRisk } from '@/core/exif/risk';
import type { ExifField, RiskLevel } from '@/core/exif/types';
import { describe, expect, it } from 'vitest';

// テスト用に最小フィールドオブジェクトを構築するヘルパー
function makeField(
  category: ExifField['category'],
  key: string,
  overrides: Partial<ExifField> = {},
): ExifField {
  return {
    key,
    category,
    risk: 'low',
    displayValue: String(key),
    rawValue: null,
    ...overrides,
  };
}

describe('riskOfField', () => {
  describe('高リスク (high)', () => {
    it('GPS カテゴリはすべて high', () => {
      expect(riskOfField(makeField('gps', 'GPSLatitude'))).toBe('high');
      expect(riskOfField(makeField('gps', 'GPSLongitude'))).toBe('high');
      expect(riskOfField(makeField('gps', 'GPSAltitude'))).toBe('high');
    });

    it('シリアル番号系のデバイスフィールドは high', () => {
      expect(riskOfField(makeField('device', 'SerialNumber'))).toBe('high');
      expect(riskOfField(makeField('device', 'BodySerialNumber'))).toBe('high');
      expect(riskOfField(makeField('device', 'CameraSerialNumber'))).toBe('high');
    });

    it('レンズシリアル番号は high', () => {
      expect(riskOfField(makeField('lens', 'LensSerialNumber'))).toBe('high');
    });
  });

  describe('中リスク (medium)', () => {
    it('デバイスメーカー・モデルは medium', () => {
      expect(riskOfField(makeField('device', 'Make'))).toBe('medium');
      expect(riskOfField(makeField('device', 'Model'))).toBe('medium');
    });

    it('撮影日時は medium', () => {
      expect(riskOfField(makeField('datetime', 'DateTimeOriginal'))).toBe('medium');
      expect(riskOfField(makeField('datetime', 'CreateDate'))).toBe('medium');
      expect(riskOfField(makeField('datetime', 'ModifyDate'))).toBe('medium');
    });
  });

  describe('低リスク (low)', () => {
    it('ソフトウェア情報は low', () => {
      expect(riskOfField(makeField('software', 'Software'))).toBe('low');
      expect(riskOfField(makeField('software', 'ProcessingSoftware'))).toBe('low');
    });

    it('撮影パラメータは low', () => {
      expect(riskOfField(makeField('capture', 'FNumber'))).toBe('low');
      expect(riskOfField(makeField('capture', 'ISO'))).toBe('low');
      expect(riskOfField(makeField('capture', 'ExposureTime'))).toBe('low');
    });

    it('向き情報は low', () => {
      expect(riskOfField(makeField('orientation', 'Orientation'))).toBe('low');
    });

    it('other カテゴリは low', () => {
      expect(riskOfField(makeField('other', 'UnknownTag'))).toBe('low');
    });

    it('レンズ (シリアル除く) は low', () => {
      expect(riskOfField(makeField('lens', 'LensMake'))).toBe('low');
      expect(riskOfField(makeField('lens', 'LensModel'))).toBe('low');
    });
  });
});

describe('summaryRisk', () => {
  it('フィールドが空のとき none を返す', () => {
    expect(summaryRisk([])).toBe('none');
  });

  it('high が含まれれば high を返す', () => {
    const fields: readonly RiskLevel[] = ['low', 'high', 'medium'];
    expect(summaryRisk(fields)).toBe('high');
  });

  it('medium のみなら medium を返す', () => {
    const fields: readonly RiskLevel[] = ['low', 'medium', 'low'];
    expect(summaryRisk(fields)).toBe('medium');
  });

  it('low のみなら low を返す', () => {
    const fields: readonly RiskLevel[] = ['low', 'low'];
    expect(summaryRisk(fields)).toBe('low');
  });

  it('単一 high は high を返す', () => {
    expect(summaryRisk(['high'])).toBe('high');
  });

  it('単一 medium は medium を返す', () => {
    expect(summaryRisk(['medium'])).toBe('medium');
  });

  it('単一 low は low を返す', () => {
    expect(summaryRisk(['low'])).toBe('low');
  });
});
