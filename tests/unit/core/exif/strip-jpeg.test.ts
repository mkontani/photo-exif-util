import { parseExif } from '@/core/exif/parse';
import { stripJpeg } from '@/core/exif/strip-jpeg';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

describe('stripJpeg', () => {
  describe('T1: 全削除 (remove: all)', () => {
    it('全削除後に parseExif の fields が空になる', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const parsed = await parseExif(result.blob);
      expect(parsed.fields.length).toBe(0);
    });

    it('removedKeys に削除されたキーが含まれる', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      expect(result.removedKeys.length).toBeGreaterThan(0);
    });

    it('format が jpeg', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      expect(result.format).toBe('jpeg');
    });
  });

  describe('T2: GPS のみ削除 (remove: [gps])', () => {
    it('GPSLatitude フィールドが削除される', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: ['gps'] });
      const parsed = await parseExif(result.blob);
      expect(parsed.fields.some((f) => f.key === 'GPSLatitude')).toBe(false);
    });

    it('Make フィールドは残る', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: ['gps'] });
      const parsed = await parseExif(result.blob);
      expect(parsed.fields.some((f) => f.key === 'Make')).toBe(true);
    });

    it('DateTimeOriginal フィールドは残る', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: ['gps'] });
      const parsed = await parseExif(result.blob);
      expect(parsed.fields.some((f) => f.key === 'DateTimeOriginal')).toBe(true);
    });

    it('removedKeys に GPS 系キーが含まれる', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: ['gps'] });
      expect(result.removedKeys.some((k) => k.startsWith('GPS'))).toBe(true);
    });
  });

  describe('T3: JPEG の valid 性維持', () => {
    it('全削除後も JPEG として valid (FF D8 で開始)', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
    });

    it('全削除後も FF D9 で終了する', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[bytes.length - 2]).toBe(0xff);
      expect(bytes[bytes.length - 1]).toBe(0xd9);
    });
  });

  describe('T4: 画像サイズ (SOF0) 維持', () => {
    it('全削除後も SOF0 マーカーが存在する', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // SOF0 (FF C0) を検索
      let foundSof0 = false;
      for (let i = 0; i < bytes.length - 1; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xc0) {
          foundSof0 = true;
          break;
        }
      }
      expect(foundSof0).toBe(true);
    });

    it('全削除後も SOF0 の幅が 1 (フィクスチャは 1x1)', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // SOF0 位置を探して幅を確認
      for (let i = 0; i < bytes.length - 8; i++) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xc0) {
          // SOF0: length(2) + precision(1) + height(2) + width(2)
          const width = ((bytes[i + 7] ?? 0) << 8) | (bytes[i + 8] ?? 0);
          expect(width).toBe(1);
          break;
        }
      }
    });
  });

  describe('T5: EXIF なし JPEG に対して strip (no-op)', () => {
    it('EXIF なし JPEG でも エラーなく動作する', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      await expect(stripJpeg(blob, { remove: 'all' })).resolves.toBeDefined();
    });

    it('EXIF なし JPEG の strip 後は parseExif が fields 空を返す', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const parsed = await parseExif(result.blob);
      expect(parsed.fields.length).toBe(0);
    });

    it('EXIF なし JPEG の strip 後も JPEG valid (FF D8)', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await stripJpeg(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
    });
  });

  describe('T6: 冪等性', () => {
    it('strip → strip で出力バイトが同一', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const first = await stripJpeg(blob, { remove: 'all' });
      const second = await stripJpeg(first.blob, { remove: 'all' });

      const buf1 = await first.blob.arrayBuffer();
      const buf2 = await second.blob.arrayBuffer();
      expect(new Uint8Array(buf1)).toEqual(new Uint8Array(buf2));
    });
  });

  describe('keep オプション', () => {
    it('keep: [device] で Make/Model だけ残る', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await stripJpeg(blob, { keep: ['device'] });
      const parsed = await parseExif(result.blob);
      // GPS は削除される
      expect(parsed.fields.some((f) => f.key === 'GPSLatitude')).toBe(false);
      // Make は残る
      expect(parsed.fields.some((f) => f.key === 'Make')).toBe(true);
    });
  });
});
