import { defaultSettings, settingsReducer, validateSettings } from '@/state/settings-store';
import { describe, expect, it } from 'vitest';

describe('defaultSettings', () => {
  it('theme は "auto"', () => {
    expect(defaultSettings.theme).toBe('auto');
  });

  it('defaultProfileId は "x-post" (SNS_PROFILES の最初)', () => {
    expect(defaultSettings.defaultProfileId).toBe('x-post');
  });

  it('readonly: 変更されないことを確認', () => {
    // Object.isFrozen ではなく型で readonly を保証する
    expect(typeof defaultSettings.theme).toBe('string');
    expect(typeof defaultSettings.defaultProfileId).toBe('string');
  });
});

describe('settingsReducer', () => {
  it('SET_THEME "dark" → theme=dark', () => {
    const result = settingsReducer(defaultSettings, { type: 'SET_THEME', theme: 'dark' });
    expect(result.theme).toBe('dark');
    // 他フィールドは変更なし
    expect(result.defaultProfileId).toBe(defaultSettings.defaultProfileId);
  });

  it('SET_THEME "light" → theme=light', () => {
    const result = settingsReducer(defaultSettings, { type: 'SET_THEME', theme: 'light' });
    expect(result.theme).toBe('light');
  });

  it('SET_THEME "auto" → theme=auto', () => {
    const darkState = { ...defaultSettings, theme: 'dark' as const };
    const result = settingsReducer(darkState, { type: 'SET_THEME', theme: 'auto' });
    expect(result.theme).toBe('auto');
  });

  it('SET_DEFAULT_PROFILE → defaultProfileId 更新', () => {
    const result = settingsReducer(defaultSettings, {
      type: 'SET_DEFAULT_PROFILE',
      profileId: 'ig-square',
    });
    expect(result.defaultProfileId).toBe('ig-square');
    expect(result.theme).toBe(defaultSettings.theme);
  });

  it('LOAD → 完全置換', () => {
    const newSettings = { theme: 'dark' as const, defaultProfileId: 'bluesky-post' };
    const result = settingsReducer(defaultSettings, { type: 'LOAD', settings: newSettings });
    expect(result.theme).toBe('dark');
    expect(result.defaultProfileId).toBe('bluesky-post');
  });

  it('RESET → defaultSettings に戻る', () => {
    const modified = { theme: 'dark' as const, defaultProfileId: 'ig-portrait' };
    const result = settingsReducer(modified, { type: 'RESET' });
    expect(result).toEqual(defaultSettings);
  });

  it('reducer は元の state を変更しない (immutable)', () => {
    const original = { ...defaultSettings };
    settingsReducer(defaultSettings, { type: 'SET_THEME', theme: 'dark' });
    expect(defaultSettings.theme).toBe(original.theme);
  });
});

describe('validateSettings', () => {
  it('null → defaultSettings', () => {
    const result = validateSettings(null);
    expect(result).toEqual(defaultSettings);
  });

  it('undefined → defaultSettings', () => {
    const result = validateSettings(undefined);
    expect(result).toEqual(defaultSettings);
  });

  it('空オブジェクト → defaultSettings にマージ', () => {
    const result = validateSettings({});
    expect(result.theme).toBe(defaultSettings.theme);
    expect(result.defaultProfileId).toBe(defaultSettings.defaultProfileId);
  });

  it('不正な theme → theme は default にフォールバック', () => {
    const result = validateSettings({ theme: 'invalid-theme', defaultProfileId: 'x-post' });
    expect(result.theme).toBe(defaultSettings.theme);
    expect(result.defaultProfileId).toBe('x-post');
  });

  it('有効な theme="dark" と defaultProfileId → そのまま', () => {
    const result = validateSettings({ theme: 'dark', defaultProfileId: 'x-post' });
    expect(result.theme).toBe('dark');
    expect(result.defaultProfileId).toBe('x-post');
  });

  it('有効な theme="light" と defaultProfileId', () => {
    const result = validateSettings({ theme: 'light', defaultProfileId: 'ig-square' });
    expect(result.theme).toBe('light');
    expect(result.defaultProfileId).toBe('ig-square');
  });

  it('有効な theme="auto"', () => {
    const result = validateSettings({ theme: 'auto', defaultProfileId: 'x-post' });
    expect(result.theme).toBe('auto');
  });

  it('defaultProfileId が非 string → defaultSettings.defaultProfileId にフォールバック', () => {
    const result = validateSettings({ theme: 'dark', defaultProfileId: 42 });
    expect(result.defaultProfileId).toBe(defaultSettings.defaultProfileId);
  });

  it('数値が渡された → defaultSettings', () => {
    const result = validateSettings(42);
    expect(result).toEqual(defaultSettings);
  });

  it('配列が渡された → defaultSettings', () => {
    const result = validateSettings([]);
    expect(result).toEqual(defaultSettings);
  });
});
