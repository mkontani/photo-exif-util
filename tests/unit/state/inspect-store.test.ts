import type { ExifField, ExifSummary } from '@/core/exif/types';
import type { ImageSource } from '@/core/ingest/types';
import { filterFields, initialInspectState, inspectReducer } from '@/state/inspect-store';
import { describe, expect, it } from 'vitest';

// テスト用フィクスチャ
const mockSource: ImageSource = { kind: 'file', name: 'test.jpg' };

const mockBlob = new Blob(['fake'], { type: 'image/jpeg' });

const mockSummary: ExifSummary = {
  format: 'jpeg',
  fields: [
    {
      key: 'GPSLatitude',
      category: 'gps',
      risk: 'high',
      displayValue: '35.6895',
      rawValue: 35.6895,
    },
    {
      key: 'Make',
      category: 'device',
      risk: 'low',
      displayValue: 'Canon',
      rawValue: 'Canon',
    },
  ],
  hasGps: true,
  highestRisk: 'high',
};

describe('inspectReducer', () => {
  it('初期状態は idle', () => {
    expect(initialInspectState.status).toBe('idle');
    expect(initialInspectState.filter.query).toBe('');
    expect(initialInspectState.filter.category).toBe('all');
  });

  it('INGEST_START → status: loading、source をセット', () => {
    const next = inspectReducer(initialInspectState, {
      type: 'INGEST_START',
      source: mockSource,
    });
    expect(next.status).toBe('loading');
    expect(next.source).toEqual(mockSource);
    // 元の状態は変更しない (immutable)
    expect(initialInspectState.status).toBe('idle');
  });

  it('INGEST_SUCCESS → status: success、blob と summary をセット', () => {
    const loading = inspectReducer(initialInspectState, {
      type: 'INGEST_START',
      source: mockSource,
    });
    const next = inspectReducer(loading, {
      type: 'INGEST_SUCCESS',
      blob: mockBlob,
      summary: mockSummary,
      source: mockSource,
    });
    expect(next.status).toBe('success');
    expect(next.blob).toBe(mockBlob);
    expect(next.summary).toEqual(mockSummary);
    expect(next.errorCode).toBeUndefined();
  });

  it('INGEST_ERROR → status: error、errorCode と errorMessage をセット', () => {
    const next = inspectReducer(initialInspectState, {
      type: 'INGEST_ERROR',
      code: 'INVALID_FORMAT',
      message: 'Not a valid image',
    });
    expect(next.status).toBe('error');
    expect(next.errorCode).toBe('INVALID_FORMAT');
    expect(next.errorMessage).toBe('Not a valid image');
    expect(next.blob).toBeUndefined();
  });

  it('SET_QUERY → filter.query を更新する', () => {
    const next = inspectReducer(initialInspectState, {
      type: 'SET_QUERY',
      query: 'GPS',
    });
    expect(next.filter.query).toBe('GPS');
    expect(next.filter.category).toBe('all');
  });

  it('SET_CATEGORY → filter.category を更新する', () => {
    const next = inspectReducer(initialInspectState, {
      type: 'SET_CATEGORY',
      category: 'gps',
    });
    expect(next.filter.category).toBe('gps');
    expect(next.filter.query).toBe('');
  });

  it('RESET → initialInspectState に戻る', () => {
    const modified = inspectReducer(initialInspectState, {
      type: 'INGEST_SUCCESS',
      blob: mockBlob,
      summary: mockSummary,
      source: mockSource,
    });
    const reset = inspectReducer(modified, { type: 'RESET' });
    expect(reset).toEqual(initialInspectState);
  });

  it('元の状態オブジェクトを変更しない (immutable)', () => {
    const state = { ...initialInspectState };
    inspectReducer(state, { type: 'SET_QUERY', query: 'test' });
    expect(state.filter.query).toBe('');
  });
});

describe('filterFields', () => {
  const fields: readonly ExifField[] = [
    {
      key: 'GPSLatitude',
      category: 'gps',
      risk: 'high',
      displayValue: '35.6895',
      rawValue: 35.6895,
    },
    {
      key: 'GPSLongitude',
      category: 'gps',
      risk: 'high',
      displayValue: '139.6917',
      rawValue: 139.6917,
    },
    {
      key: 'Make',
      category: 'device',
      risk: 'low',
      displayValue: 'Canon',
      rawValue: 'Canon',
    },
    {
      key: 'DateTime',
      category: 'datetime',
      risk: 'medium',
      displayValue: '2024-01-01T00:00:00',
      rawValue: '2024:01:01 00:00:00',
    },
  ];

  it('query も category も all なら全件返す', () => {
    const result = filterFields(fields, { query: '', category: 'all' });
    expect(result).toHaveLength(4);
  });

  it('query でキーを case-insensitive contains 検索する', () => {
    const result = filterFields(fields, { query: 'gps', category: 'all' });
    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe('GPSLatitude');
  });

  it('category でカテゴリ絞り込みをする', () => {
    const result = filterFields(fields, { query: '', category: 'gps' });
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.category === 'gps')).toBe(true);
  });

  it('query と category の AND 条件で絞り込む', () => {
    const result = filterFields(fields, { query: 'GPS', category: 'gps' });
    expect(result).toHaveLength(2);
  });

  it('大文字小文字を無視して検索する', () => {
    const result = filterFields(fields, { query: 'MAKE', category: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('Make');
  });

  it('一致しない query は空配列を返す', () => {
    const result = filterFields(fields, { query: 'NoSuchKey', category: 'all' });
    expect(result).toHaveLength(0);
  });

  it('フィールドが空配列なら空配列を返す', () => {
    const result = filterFields([], { query: 'GPS', category: 'all' });
    expect(result).toHaveLength(0);
  });

  it('category が gps で query が Longitude → 1件', () => {
    const result = filterFields(fields, { query: 'longitude', category: 'gps' });
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('GPSLongitude');
  });
});
