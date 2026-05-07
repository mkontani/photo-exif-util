import type { StripResult } from '@/core/exif/strip';
import { buildStripOptions, initialStripState, stripReducer } from '@/state/strip-store';
import { describe, expect, it } from 'vitest';

// テスト用フィクスチャ
const mockBlob = new Blob(['fake'], { type: 'image/jpeg' });
const mockStripResult: StripResult = {
  blob: mockBlob,
  removedKeys: ['GPSLatitude', 'GPSLongitude'],
  format: 'jpeg',
};

describe('initialStripState', () => {
  it('status が idle', () => {
    expect(initialStripState.status).toBe('idle');
  });

  it('selectedCategories が空配列', () => {
    expect(initialStripState.selectedCategories).toHaveLength(0);
  });

  it('keepIcc が true', () => {
    expect(initialStripState.keepIcc).toBe(true);
  });

  it('result が undefined', () => {
    expect(initialStripState.result).toBeUndefined();
  });
});

describe('stripReducer - TOGGLE_CATEGORY', () => {
  it('未選択カテゴリを TOGGLE_CATEGORY すると追加される', () => {
    const next = stripReducer(initialStripState, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    expect(next.selectedCategories).toContain('gps');
    expect(next.selectedCategories).toHaveLength(1);
  });

  it('選択済みカテゴリを TOGGLE_CATEGORY すると削除される', () => {
    const withGps = stripReducer(initialStripState, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    const next = stripReducer(withGps, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    expect(next.selectedCategories).not.toContain('gps');
    expect(next.selectedCategories).toHaveLength(0);
  });

  it('複数カテゴリを個別に追加できる', () => {
    let state = stripReducer(initialStripState, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    state = stripReducer(state, { type: 'TOGGLE_CATEGORY', category: 'device' });
    state = stripReducer(state, { type: 'TOGGLE_CATEGORY', category: 'lens' });
    expect(state.selectedCategories).toHaveLength(3);
    expect(state.selectedCategories).toContain('gps');
    expect(state.selectedCategories).toContain('device');
    expect(state.selectedCategories).toContain('lens');
  });

  it('元の state を変更しない (immutable)', () => {
    const before = { ...initialStripState };
    stripReducer(initialStripState, { type: 'TOGGLE_CATEGORY', category: 'gps' });
    expect(initialStripState.selectedCategories).toHaveLength(0);
    expect(before.selectedCategories).toHaveLength(0);
  });
});

describe('stripReducer - SELECT_ALL', () => {
  it('SELECT_ALL で 7 カテゴリ全選択される', () => {
    const next = stripReducer(initialStripState, { type: 'SELECT_ALL' });
    expect(next.selectedCategories).toHaveLength(7);
    expect(next.selectedCategories).toContain('gps');
    expect(next.selectedCategories).toContain('device');
    expect(next.selectedCategories).toContain('lens');
    expect(next.selectedCategories).toContain('capture');
    expect(next.selectedCategories).toContain('datetime');
    expect(next.selectedCategories).toContain('software');
    expect(next.selectedCategories).toContain('orientation');
    // icc は ExifCategory ではないので含まない
    expect(next.selectedCategories).not.toContain('icc');
  });
});

describe('stripReducer - SELECT_NONE', () => {
  it('SELECT_NONE で空配列になる', () => {
    const withAll = stripReducer(initialStripState, { type: 'SELECT_ALL' });
    const next = stripReducer(withAll, { type: 'SELECT_NONE' });
    expect(next.selectedCategories).toHaveLength(0);
  });
});

describe('stripReducer - TOGGLE_KEEP_ICC', () => {
  it('TOGGLE_KEEP_ICC で keepIcc が反転する (true → false)', () => {
    const next = stripReducer(initialStripState, { type: 'TOGGLE_KEEP_ICC' });
    expect(next.keepIcc).toBe(false);
  });

  it('TOGGLE_KEEP_ICC で keepIcc が反転する (false → true)', () => {
    const withFalse = stripReducer(initialStripState, { type: 'TOGGLE_KEEP_ICC' });
    const next = stripReducer(withFalse, { type: 'TOGGLE_KEEP_ICC' });
    expect(next.keepIcc).toBe(true);
  });
});

describe('stripReducer - STRIP_START', () => {
  it('STRIP_START で status が running になる', () => {
    const next = stripReducer(initialStripState, { type: 'STRIP_START' });
    expect(next.status).toBe('running');
  });

  it('STRIP_START で result がクリアされる', () => {
    const withResult = stripReducer(initialStripState, {
      type: 'STRIP_SUCCESS',
      result: mockStripResult,
    });
    const next = stripReducer(withResult, { type: 'STRIP_START' });
    expect(next.result).toBeUndefined();
    expect(next.errorCode).toBeUndefined();
    expect(next.errorMessage).toBeUndefined();
  });
});

describe('stripReducer - STRIP_SUCCESS', () => {
  it('STRIP_SUCCESS で status が success になり result がセットされる', () => {
    const running = stripReducer(initialStripState, { type: 'STRIP_START' });
    const next = stripReducer(running, {
      type: 'STRIP_SUCCESS',
      result: mockStripResult,
    });
    expect(next.status).toBe('success');
    expect(next.result).toBe(mockStripResult);
    expect(next.errorCode).toBeUndefined();
  });
});

describe('stripReducer - STRIP_ERROR', () => {
  it('STRIP_ERROR で status が error になり errorCode / errorMessage がセットされる', () => {
    const running = stripReducer(initialStripState, { type: 'STRIP_START' });
    const next = stripReducer(running, {
      type: 'STRIP_ERROR',
      code: 'STRIP_ERROR',
      message: '処理に失敗しました',
    });
    expect(next.status).toBe('error');
    expect(next.errorCode).toBe('STRIP_ERROR');
    expect(next.errorMessage).toBe('処理に失敗しました');
    expect(next.result).toBeUndefined();
  });
});

describe('stripReducer - RESET', () => {
  it('RESET で initialStripState に戻る', () => {
    const modified = stripReducer(stripReducer(initialStripState, { type: 'SELECT_ALL' }), {
      type: 'STRIP_SUCCESS',
      result: mockStripResult,
    });
    const reset = stripReducer(modified, { type: 'RESET' });
    expect(reset).toEqual(initialStripState);
  });
});

describe('buildStripOptions', () => {
  it('全選択 + keepIcc=false → remove: "all"', () => {
    const allSelected = stripReducer(initialStripState, { type: 'SELECT_ALL' });
    const withKeepIccFalse = stripReducer(allSelected, { type: 'TOGGLE_KEEP_ICC' });
    // keepIcc は最初 true なので TOGGLE で false になる
    expect(withKeepIccFalse.keepIcc).toBe(false);
    const opts = buildStripOptions(withKeepIccFalse);
    expect(opts.remove).toBe('all');
  });

  it('全選択 + keepIcc=true → remove は 7 カテゴリ配列 (icc 含まず)', () => {
    const allSelected = stripReducer(initialStripState, { type: 'SELECT_ALL' });
    // keepIcc はデフォルト true
    expect(allSelected.keepIcc).toBe(true);
    const opts = buildStripOptions(allSelected);
    expect(Array.isArray(opts.remove)).toBe(true);
    const removeArr = opts.remove as readonly string[];
    expect(removeArr).toHaveLength(7);
    expect(removeArr).not.toContain('icc');
    expect(removeArr).toContain('gps');
    expect(removeArr).toContain('device');
    expect(removeArr).toContain('lens');
    expect(removeArr).toContain('capture');
    expect(removeArr).toContain('datetime');
    expect(removeArr).toContain('software');
    expect(removeArr).toContain('orientation');
  });

  it('部分選択 → 選択したカテゴリのみの配列', () => {
    let state = stripReducer(initialStripState, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    state = stripReducer(state, { type: 'TOGGLE_CATEGORY', category: 'device' });
    const opts = buildStripOptions(state);
    expect(Array.isArray(opts.remove)).toBe(true);
    const removeArr = opts.remove as readonly string[];
    expect(removeArr).toHaveLength(2);
    expect(removeArr).toContain('gps');
    expect(removeArr).toContain('device');
  });

  it('未選択 → 空配列', () => {
    const opts = buildStripOptions(initialStripState);
    expect(Array.isArray(opts.remove)).toBe(true);
    expect(opts.remove as readonly string[]).toHaveLength(0);
  });

  it('一部選択 + keepIcc=false → 選択カテゴリ + icc が含まれる ("all" にはならない)', () => {
    // 設計: keepIcc=false は「ICC も削除する」明示意思なので部分選択でも icc を含める
    let state = stripReducer(initialStripState, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    state = stripReducer(state, { type: 'TOGGLE_KEEP_ICC' }); // false に
    const opts = buildStripOptions(state);
    expect(opts.remove).not.toBe('all');
    const removeArr = opts.remove as readonly string[];
    expect(removeArr).toContain('gps');
    expect(removeArr).toContain('icc');
    expect(removeArr).toHaveLength(2);
  });

  it('一部選択 + keepIcc=true → icc を含まず選択カテゴリのみ', () => {
    const state = stripReducer(initialStripState, {
      type: 'TOGGLE_CATEGORY',
      category: 'gps',
    });
    // 初期状態の keepIcc=true のまま
    const opts = buildStripOptions(state);
    expect(opts.remove).not.toBe('all');
    const removeArr = opts.remove as readonly string[];
    expect(removeArr).toContain('gps');
    expect(removeArr).not.toContain('icc');
    expect(removeArr).toHaveLength(1);
  });
});
