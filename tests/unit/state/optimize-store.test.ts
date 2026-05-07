import type { SnsApplyResult } from '@/core/sns/types';
import type { SnsProfile } from '@/core/sns/types';
import { effectiveProfile, initialOptimizeState, optimizeReducer } from '@/state/optimize-store';
import { describe, expect, it } from 'vitest';

const mockBlob = new Blob(['fake'], { type: 'image/jpeg' });

const mockApplyResult: SnsApplyResult = {
  blob: mockBlob,
  outputDimensions: { width: 1080, height: 1080 },
  outputFormat: 'jpeg',
  outputSizeBytes: 102400,
  quality: 85,
  profileId: 'ig-square',
  removedExifKeys: ['GPSLatitude'],
  sizeTargetReached: true,
};

// テスト用プロファイルフィクスチャ
const testProfile: SnsProfile = {
  id: 'test-profile',
  label: 'Test Profile',
  maxWidth: 1080,
  maxHeight: 1080,
  preferredFormat: 'jpeg',
  defaultQuality: 85,
  stripExif: true,
  defaultStripCategories: 'all',
};

describe('initialOptimizeState', () => {
  it('status が idle', () => {
    expect(initialOptimizeState.status).toBe('idle');
  });

  it('selectedProfileId が "x-post"', () => {
    expect(initialOptimizeState.selectedProfileId).toBe('x-post');
  });

  it('customQuality が undefined', () => {
    expect(initialOptimizeState.customQuality).toBeUndefined();
  });

  it('result が undefined', () => {
    expect(initialOptimizeState.result).toBeUndefined();
  });
});

describe('optimizeReducer - SELECT_PROFILE', () => {
  it('SELECT_PROFILE で selectedProfileId が更新される', () => {
    const next = optimizeReducer(initialOptimizeState, {
      type: 'SELECT_PROFILE',
      profileId: 'ig-square',
    });
    expect(next.selectedProfileId).toBe('ig-square');
  });

  it('SELECT_PROFILE で customQuality がクリアされる', () => {
    const withQuality = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 70,
    });
    const next = optimizeReducer(withQuality, {
      type: 'SELECT_PROFILE',
      profileId: 'ig-square',
    });
    expect(next.customQuality).toBeUndefined();
  });

  it('元の state を変更しない (immutable)', () => {
    optimizeReducer(initialOptimizeState, {
      type: 'SELECT_PROFILE',
      profileId: 'ig-square',
    });
    expect(initialOptimizeState.selectedProfileId).toBe('x-post');
  });
});

describe('optimizeReducer - SET_QUALITY', () => {
  it('SET_QUALITY で customQuality がセットされる', () => {
    const next = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 75,
    });
    expect(next.customQuality).toBe(75);
  });

  it('0 を SET_QUALITY できる', () => {
    const next = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 0,
    });
    expect(next.customQuality).toBe(0);
  });

  it('100 を SET_QUALITY できる', () => {
    const next = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 100,
    });
    expect(next.customQuality).toBe(100);
  });
});

describe('optimizeReducer - CLEAR_QUALITY', () => {
  it('CLEAR_QUALITY で customQuality が undefined になる', () => {
    const withQuality = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 70,
    });
    const next = optimizeReducer(withQuality, { type: 'CLEAR_QUALITY' });
    expect(next.customQuality).toBeUndefined();
  });
});

describe('optimizeReducer - OPTIMIZE_START', () => {
  it('OPTIMIZE_START で status が running になる', () => {
    const next = optimizeReducer(initialOptimizeState, { type: 'OPTIMIZE_START' });
    expect(next.status).toBe('running');
  });

  it('OPTIMIZE_START で result / error がクリアされる', () => {
    const withResult = optimizeReducer(initialOptimizeState, {
      type: 'OPTIMIZE_SUCCESS',
      result: mockApplyResult,
    });
    const next = optimizeReducer(withResult, { type: 'OPTIMIZE_START' });
    expect(next.result).toBeUndefined();
    expect(next.errorCode).toBeUndefined();
    expect(next.errorMessage).toBeUndefined();
  });
});

describe('optimizeReducer - OPTIMIZE_SUCCESS', () => {
  it('OPTIMIZE_SUCCESS で status が success になり result がセットされる', () => {
    const running = optimizeReducer(initialOptimizeState, { type: 'OPTIMIZE_START' });
    const next = optimizeReducer(running, {
      type: 'OPTIMIZE_SUCCESS',
      result: mockApplyResult,
    });
    expect(next.status).toBe('success');
    expect(next.result).toBe(mockApplyResult);
    expect(next.errorCode).toBeUndefined();
  });
});

describe('optimizeReducer - OPTIMIZE_ERROR', () => {
  it('OPTIMIZE_ERROR で status が error になり errorCode / errorMessage がセットされる', () => {
    const running = optimizeReducer(initialOptimizeState, { type: 'OPTIMIZE_START' });
    const next = optimizeReducer(running, {
      type: 'OPTIMIZE_ERROR',
      code: 'ENCODE_FAILED',
      message: 'エンコードに失敗しました',
    });
    expect(next.status).toBe('error');
    expect(next.errorCode).toBe('ENCODE_FAILED');
    expect(next.errorMessage).toBe('エンコードに失敗しました');
    expect(next.result).toBeUndefined();
  });
});

describe('optimizeReducer - RESET', () => {
  it('RESET で initialOptimizeState に戻る', () => {
    const modified = optimizeReducer(
      optimizeReducer(initialOptimizeState, {
        type: 'SELECT_PROFILE',
        profileId: 'ig-square',
      }),
      { type: 'SET_QUALITY', quality: 70 },
    );
    const reset = optimizeReducer(modified, { type: 'RESET' });
    expect(reset).toEqual(initialOptimizeState);
  });
});

describe('effectiveProfile', () => {
  it('customQuality 未指定のとき profile をそのまま返す', () => {
    const result = effectiveProfile(initialOptimizeState, testProfile);
    expect(result.defaultQuality).toBe(testProfile.defaultQuality);
    expect(result).toEqual(testProfile);
  });

  it('customQuality=70 のとき defaultQuality が 70 に上書きされる', () => {
    const state = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 70,
    });
    const result = effectiveProfile(state, testProfile);
    expect(result.defaultQuality).toBe(70);
    // id や他のフィールドは変わらない
    expect(result.id).toBe(testProfile.id);
    expect(result.maxWidth).toBe(testProfile.maxWidth);
  });

  it('customQuality=0 のとき defaultQuality が 0 に上書きされる', () => {
    const state = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 0,
    });
    const result = effectiveProfile(state, testProfile);
    expect(result.defaultQuality).toBe(0);
  });

  it('customQuality=100 のとき defaultQuality が 100 に上書きされる', () => {
    const state = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 100,
    });
    const result = effectiveProfile(state, testProfile);
    expect(result.defaultQuality).toBe(100);
  });

  it('元の profile オブジェクトを変更しない (immutable)', () => {
    const state = optimizeReducer(initialOptimizeState, {
      type: 'SET_QUALITY',
      quality: 50,
    });
    effectiveProfile(state, testProfile);
    // 元の testProfile は変わっていない
    expect(testProfile.defaultQuality).toBe(85);
  });
});
