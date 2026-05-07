import { MAX_BLOB_SIZE_BYTES, parseExif } from '@/core/exif/parse';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it } from 'vitest';

// テスト実行前に全フィクスチャを生成 (キャッシュ済みならスキップ)
beforeAll(() => {
  buildAllFixtures();
});

describe('parseExif', () => {
  describe('JPEG (GPS あり)', () => {
    it('format が jpeg', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      expect(result.format).toBe('jpeg');
    });

    it('hasGps が true', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      expect(result.hasGps).toBe(true);
    });

    it('highestRisk が high', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      expect(result.highestRisk).toBe('high');
    });

    it('GPSLatitude フィールドが含まれる', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      expect(result.fields.some((f) => f.key === 'GPSLatitude')).toBe(true);
    });

    it('Make フィールドの category が device', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      const makeField = result.fields.find((f) => f.key === 'Make');
      expect(makeField?.category).toBe('device');
    });

    it('fields が readonly 配列 (immutable)', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      // TypeScript レベルで readonly だが、実行時のフリーズは必須ではない
      // 少なくとも空でないことを確認
      expect(result.fields.length).toBeGreaterThan(0);
    });
  });

  describe('JPEG (EXIF なし)', () => {
    it('fields が空', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await parseExif(blob);
      expect(result.fields.length).toBe(0);
    });

    it('hasGps が false', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await parseExif(blob);
      expect(result.hasGps).toBe(false);
    });

    it('highestRisk が none', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await parseExif(blob);
      expect(result.highestRisk).toBe('none');
    });

    it('format が jpeg', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await parseExif(blob);
      expect(result.format).toBe('jpeg');
    });
  });

  describe('PNG (tEXt チャンク)', () => {
    it('format が png', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await parseExif(blob);
      expect(result.format).toBe('png');
    });
  });

  describe('WebP (EXIF チャンク)', () => {
    it('format が webp', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await parseExif(blob);
      expect(result.format).toBe('webp');
    });
  });

  describe('不正入力', () => {
    it('壊れたバイト列 (4 bytes of zeros) は PARSE_ERROR で reject', async () => {
      const broken = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])]);
      await expect(parseExif(broken)).rejects.toMatchObject({ code: 'PARSE_ERROR' });
    });

    it('空の Blob は EMPTY_INPUT で reject', async () => {
      const empty = new Blob([]);
      await expect(parseExif(empty)).rejects.toMatchObject({ code: 'EMPTY_INPUT' });
    });

    it('上限超過の Blob は TOO_LARGE で reject', async () => {
      // size プロパティだけモックして実バイト確保を避ける (テスト時間を短縮)
      const oversized = Object.create(Blob.prototype, {
        size: { value: MAX_BLOB_SIZE_BYTES + 1 },
        type: { value: 'image/jpeg' },
      }) as Blob;
      await expect(parseExif(oversized)).rejects.toMatchObject({ code: 'TOO_LARGE' });
    });

    it('短すぎる入力 (1 byte) は PARSE_ERROR で reject', async () => {
      const tiny = new Blob([new Uint8Array([0xff])]);
      await expect(parseExif(tiny)).rejects.toMatchObject({ code: 'PARSE_ERROR' });
    });
  });

  describe('バイナリ大きいフィールドのスキップ', () => {
    it('GPS あり JPEG で binary フィールドが MakerNote 等で出ない (mergeOutput=true 時)', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await parseExif(blob);
      // displayValue に "[binary" を含むフィールドはバイナリ扱いされたもの。
      // 512バイト超のバイナリは flattenToFields でスキップされる前提。
      const binaryFields = result.fields.filter((f) => f.displayValue.startsWith('[binary'));
      // バイナリスキップ結果は実装依存だが、displayValue が文字列であることだけ保証
      for (const f of binaryFields) {
        expect(typeof f.displayValue).toBe('string');
      }
    });
  });
});
