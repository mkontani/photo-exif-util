import { extractErrorInfo } from '@/utils/error';
import { describe, expect, it } from 'vitest';

describe('extractErrorInfo', () => {
  describe('Error インスタンス', () => {
    it('Error インスタンスは fallbackCode=undefined → code=UNKNOWN_ERROR', () => {
      const result = extractErrorInfo(new Error('boom'));
      expect(result).toEqual({ code: 'UNKNOWN_ERROR', message: 'boom' });
    });

    it('Error インスタンスに fallbackCode を指定するとそれが code になる', () => {
      const result = extractErrorInfo(new Error('boom'), 'PARSE_ERROR');
      expect(result).toEqual({ code: 'PARSE_ERROR', message: 'boom' });
    });

    it('message が空の Error', () => {
      const result = extractErrorInfo(new Error(''));
      expect(result).toEqual({ code: 'UNKNOWN_ERROR', message: '' });
    });
  });

  describe('code と message を持つオブジェクト', () => {
    it('code と message 両方ある → そのまま返す', () => {
      const result = extractErrorInfo({ code: 'TOO_LARGE', message: 'exceeds limit' });
      expect(result).toEqual({ code: 'TOO_LARGE', message: 'exceeds limit' });
    });

    it('code だけある (message 欠落) → message は fallback 文字列', () => {
      const result = extractErrorInfo({ code: 'X' });
      expect(result.code).toBe('X');
      // message は string である (空文字またはフォールバック文字列)
      expect(typeof result.message).toBe('string');
    });

    it('message だけある (code 欠落) → code は fallbackCode ?? UNKNOWN_ERROR', () => {
      const result = extractErrorInfo({ message: 'something went wrong' });
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(typeof result.message).toBe('string');
    });

    it('code が非 string → UNKNOWN_ERROR', () => {
      const result = extractErrorInfo({ code: 123, message: 'msg' });
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('両方欠落の空オブジェクト → fallback', () => {
      const result = extractErrorInfo({});
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(typeof result.message).toBe('string');
    });

    it('code と message 両方ある + fallbackCode は無視される', () => {
      const result = extractErrorInfo({ code: 'BRIDGE_ERROR', message: 'bridge fail' }, 'OTHER');
      expect(result).toEqual({ code: 'BRIDGE_ERROR', message: 'bridge fail' });
    });

    it('code/message を持つ IngestError スタイルオブジェクト', () => {
      const err = { code: 'FETCH_FAILED', message: 'HTTP 404', status: 404 };
      const result = extractErrorInfo(err);
      expect(result).toEqual({ code: 'FETCH_FAILED', message: 'HTTP 404' });
    });
  });

  describe('プリミティブ / null / undefined', () => {
    it('文字列 → code=UNKNOWN_ERROR, message=その文字列', () => {
      const result = extractErrorInfo('string error');
      expect(result).toEqual({ code: 'UNKNOWN_ERROR', message: 'string error' });
    });

    it('null → fallback', () => {
      const result = extractErrorInfo(null);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(typeof result.message).toBe('string');
    });

    it('undefined → fallback', () => {
      const result = extractErrorInfo(undefined);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(typeof result.message).toBe('string');
    });

    it('数値 → String(err) として message', () => {
      const result = extractErrorInfo(42);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('42');
    });

    it('boolean false → fallback', () => {
      const result = extractErrorInfo(false);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('false');
    });
  });

  describe('戻り値は readonly', () => {
    it('返却されたオブジェクトのプロパティは正しく型付けされる', () => {
      const result = extractErrorInfo(new Error('test'));
      // TypeScript の型チェックで code と message が string であること
      const _code: string = result.code;
      const _message: string = result.message;
      expect(_code).toBeTruthy();
      expect(typeof _message).toBe('string');
    });
  });
});
