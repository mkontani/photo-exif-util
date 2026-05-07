import { getErrorDisplay, listErrorDisplayKeys } from '@/utils/error-display';
import { describe, expect, it } from 'vitest';

describe('getErrorDisplay', () => {
  describe('既知のエラーコード', () => {
    it.each([
      'EMPTY_INPUT',
      'TOO_LARGE',
      'INVALID_FORMAT',
      'PARSE_ERROR',
      'INVALID_URL',
      'BLOCKED_URL',
      'FETCH_FAILED',
      'CORS_BLOCKED',
      'PERMISSION_DENIED',
      'STRIP_ERROR',
      'DECODE_FAILED',
      'RESIZE_FAILED',
      'ENCODE_FAILED',
      'SIZE_TARGET_UNREACHABLE',
      'INVALID_PROFILE',
      'BRIDGE_ERROR',
      'INVALID_RESPONSE',
    ])('%s は具体的なタイトル/説明キーを返す', (code) => {
      const result = getErrorDisplay(code);
      expect(result.titleKey).toMatch(/^errui_/);
      expect(result.descriptionKey).toMatch(/^errui_/);
      expect(['error', 'warning', 'info']).toContain(result.severity);
    });

    it('TOO_LARGE は warning severity', () => {
      expect(getErrorDisplay('TOO_LARGE').severity).toBe('warning');
    });

    it('FETCH_FAILED は error severity', () => {
      expect(getErrorDisplay('FETCH_FAILED').severity).toBe('error');
    });

    it('TOO_LARGE は対処ヒントを持つ (画像サイズ縮小を促すため)', () => {
      expect(getErrorDisplay('TOO_LARGE').hintKey).toBeDefined();
    });

    it('INVALID_FORMAT は対処ヒントを持つ (フォーマット変換を促すため)', () => {
      expect(getErrorDisplay('INVALID_FORMAT').hintKey).toBeDefined();
    });
  });

  describe('未知のエラーコード', () => {
    it('未知 code は unknown_title にフォールバック', () => {
      const result = getErrorDisplay('SOMETHING_TOTALLY_UNKNOWN');
      expect(result.titleKey).toBe('errui_unknown_title');
      expect(result.descriptionKey).toBe('errui_unknown_desc');
      expect(result.severity).toBe('error');
    });

    it('空文字列 code もフォールバック', () => {
      const result = getErrorDisplay('');
      expect(result.titleKey).toBe('errui_unknown_title');
    });
  });

  describe('immutability', () => {
    it('返り値は readonly 型 (実行時 freeze は不要、TS で保証)', () => {
      const result = getErrorDisplay('EMPTY_INPUT');
      // 同じ code を 2 回呼んでも同じ参照を共有する設計でも問題ない
      const result2 = getErrorDisplay('EMPTY_INPUT');
      expect(result.titleKey).toBe(result2.titleKey);
    });
  });
});

describe('listErrorDisplayKeys', () => {
  it('全エラーコード分のキーを列挙し、未知 code 用の fallback も含む', () => {
    const keys = listErrorDisplayKeys();
    expect(keys).toContain('errui_unknown_title');
    expect(keys).toContain('errui_unknown_desc');
    expect(keys).toContain('errui_too_large_title');
    expect(keys).toContain('errui_fetch_failed_desc');
  });

  it('結果はソート済み + 重複なし', () => {
    const keys = listErrorDisplayKeys();
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('全キーが errui_ prefix を持つ', () => {
    for (const key of listErrorDisplayKeys()) {
      expect(key).toMatch(/^errui_/);
    }
  });
});
