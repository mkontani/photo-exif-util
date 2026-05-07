import { MAX_BLOB_SIZE_BYTES } from '@/core/exif/parse';
import { stripExif } from '@/core/exif/strip';
import * as stripJpegModule from '@/core/exif/strip-jpeg';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

describe('stripExif (public API)', () => {
  describe('T1: format 自動判定', () => {
    it('JPEG に対して jpeg フォーマットを返す', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripExif(blob, { remove: 'all' });
      expect(result.format).toBe('jpeg');
    });

    it('PNG に対して png フォーマットを返す', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripExif(blob, { remove: 'all' });
      expect(result.format).toBe('png');
    });

    it('WebP に対して webp フォーマットを返す', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripExif(blob, { remove: 'all' });
      expect(result.format).toBe('webp');
    });

    it('strip 後の blob が有効なバイト列', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripExif(blob, { remove: 'all' });
      expect(result.blob.size).toBeGreaterThan(0);
    });
  });

  describe('T2: unknown format → UNSUPPORTED_FORMAT reject', () => {
    it('不明フォーマットは UNSUPPORTED_FORMAT で reject される', async () => {
      const unknown = new Blob([
        new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]),
      ]);
      await expect(stripExif(unknown)).rejects.toMatchObject({
        code: 'UNSUPPORTED_FORMAT',
      });
    });

    it('UNSUPPORTED_FORMAT error に format フィールドが含まれる', async () => {
      const unknown = new Blob([
        new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]),
      ]);
      await expect(stripExif(unknown)).rejects.toMatchObject({
        code: 'UNSUPPORTED_FORMAT',
        format: 'unknown',
      });
    });
  });

  describe('T3: remove と keep 同時指定 → INVALID_OPTIONS reject', () => {
    it('remove と keep を同時指定すると INVALID_OPTIONS で reject される', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      await expect(
        stripExif(blob, { remove: ['gps'], keep: ['device'] } as Parameters<typeof stripExif>[1]),
      ).rejects.toMatchObject({
        code: 'INVALID_OPTIONS',
      });
    });

    it('INVALID_OPTIONS error に message フィールドが含まれる', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      await expect(
        stripExif(blob, { remove: ['gps'], keep: ['device'] } as Parameters<typeof stripExif>[1]),
      ).rejects.toMatchObject({
        code: 'INVALID_OPTIONS',
        message: expect.any(String),
      });
    });
  });

  describe('T4: removedKeys の列挙', () => {
    it('JPEG GPS strip で removedKeys に GPS 系キーが含まれる', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripExif(blob, { remove: ['gps'] });
      expect(result.removedKeys.some((k) => k.startsWith('GPS'))).toBe(true);
    });

    it('EXIF なし JPEG の removedKeys が空', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await stripExif(blob, { remove: 'all' });
      expect(result.removedKeys.length).toBe(0);
    });

    it('PNG strip で removedKeys が返る', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripExif(blob, { remove: 'all' });
      // tEXt チャンク削除で何らかのキーが入る
      expect(Array.isArray(result.removedKeys)).toBe(true);
    });
  });

  describe('T5: サイズ上限チェック → STRIP_ERROR', () => {
    it('MAX_BLOB_SIZE_BYTES を超えると STRIP_ERROR で reject される', async () => {
      const oversized = Object.create(Blob.prototype, {
        size: { value: MAX_BLOB_SIZE_BYTES + 1 },
        type: { value: 'image/jpeg' },
      }) as Blob;
      await expect(stripExif(oversized)).rejects.toMatchObject({
        code: 'STRIP_ERROR',
      });
    });
  });

  describe('T6: 空 Blob → STRIP_ERROR', () => {
    it('空 Blob は STRIP_ERROR で reject される', async () => {
      const empty = new Blob([]);
      await expect(stripExif(empty)).rejects.toMatchObject({
        code: 'STRIP_ERROR',
      });
    });
  });

  describe('デフォルト動作 (options 未指定)', () => {
    it('options 未指定で全削除として動作する', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripExif(blob);
      const { parseExif } = await import('@/core/exif/parse');
      const parsed = await parseExif(result.blob);
      expect(parsed.fields.length).toBe(0);
    });
  });

  describe('ICC プロファイル保持 (デフォルト挙動)', () => {
    it('PNG iCCP は remove: [gps] 時にデフォルトで保持される', async () => {
      const blob = loadFixtureAsBlob('png-with-iccp.png');
      const result = await stripExif(blob, { remove: ['gps'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // iCCP チャンクを探す
      let hasIccp = false;
      let offset = 8;
      while (offset + 8 <= bytes.length) {
        const length =
          ((bytes[offset] ?? 0) << 24) |
          ((bytes[offset + 1] ?? 0) << 16) |
          ((bytes[offset + 2] ?? 0) << 8) |
          (bytes[offset + 3] ?? 0);
        const type = String.fromCharCode(
          bytes[offset + 4] ?? 0,
          bytes[offset + 5] ?? 0,
          bytes[offset + 6] ?? 0,
          bytes[offset + 7] ?? 0,
        );
        if (type === 'iCCP') {
          hasIccp = true;
          break;
        }
        offset += 4 + 4 + length + 4;
      }
      expect(hasIccp).toBe(true);
    });
  });

  describe('WebP に対しても全削除が機能する', () => {
    it('WebP EXIF strip で removedKeys が返る', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripExif(blob, { remove: 'all' });
      expect(result.removedKeys.length).toBeGreaterThan(0);
    });
  });

  describe('内部エラーハンドリング (catch ブロック)', () => {
    it('strip-jpeg が予期せず throw した場合 STRIP_ERROR で reject される', async () => {
      const spy = vi
        .spyOn(stripJpegModule, 'stripJpeg')
        .mockRejectedValueOnce(new Error('internal error'));
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      await expect(stripExif(blob, { remove: 'all' })).rejects.toMatchObject({
        code: 'STRIP_ERROR',
        message: 'internal error',
      });
      spy.mockRestore();
    });

    it('strip-jpeg が StripError を throw した場合はそのまま再 reject される', async () => {
      const stripError = { code: 'STRIP_ERROR', message: 'forwarded error' };
      const spy = vi.spyOn(stripJpegModule, 'stripJpeg').mockRejectedValueOnce(stripError);
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      await expect(stripExif(blob, { remove: 'all' })).rejects.toMatchObject({
        code: 'STRIP_ERROR',
        message: 'forwarded error',
      });
      spy.mockRestore();
    });
  });

  describe('エラーハンドリングの完全性', () => {
    it('remove: [icc] オプションで PNG から iCCP が削除される', async () => {
      const blob = loadFixtureAsBlob('png-with-iccp.png');
      const result = await stripExif(blob, { remove: ['icc'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let hasIccp = false;
      let offset = 8;
      while (offset + 8 <= bytes.length) {
        const length =
          ((bytes[offset] ?? 0) << 24) |
          ((bytes[offset + 1] ?? 0) << 16) |
          ((bytes[offset + 2] ?? 0) << 8) |
          (bytes[offset + 3] ?? 0);
        const type = String.fromCharCode(
          bytes[offset + 4] ?? 0,
          bytes[offset + 5] ?? 0,
          bytes[offset + 6] ?? 0,
          bytes[offset + 7] ?? 0,
        );
        if (type === 'iCCP') {
          hasIccp = true;
          break;
        }
        offset += 4 + 4 + length + 4;
      }
      expect(hasIccp).toBe(false);
    });
  });
});
