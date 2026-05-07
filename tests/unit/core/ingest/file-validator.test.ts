import { MAX_BLOB_SIZE_BYTES } from '@/core/exif/parse';
import { validateFile } from '@/core/ingest/file-validator';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

describe('validateFile', () => {
  describe('正常系', () => {
    it('JPEG ファイルは ok=true を返す', async () => {
      const file = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await validateFile(file);
      expect(result.ok).toBe(true);
    });

    it('ok=true 時に blob を返す', async () => {
      const file = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await validateFile(file);
      if (result.ok) {
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.blob.size).toBeGreaterThan(0);
      }
    });

    it('JPEG (EXIF なし) も ok=true', async () => {
      const file = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await validateFile(file);
      expect(result.ok).toBe(true);
    });

    it('PNG ファイルは ok=true', async () => {
      const file = loadFixtureAsBlob('png-with-text.png');
      const result = await validateFile(file);
      expect(result.ok).toBe(true);
    });

    it('WebP ファイルは ok=true', async () => {
      const file = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await validateFile(file);
      expect(result.ok).toBe(true);
    });

    it('File オブジェクトも受け付ける', async () => {
      const fixture = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const file = new File([fixture], 'test.jpg', { type: 'image/jpeg' });
      const result = await validateFile(file);
      expect(result.ok).toBe(true);
    });
  });

  describe('EMPTY_INPUT エラー', () => {
    it('空の Blob は EMPTY_INPUT エラー', async () => {
      const blob = new Blob([]);
      const result = await validateFile(blob);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('EMPTY_INPUT');
      }
    });

    it('空の File は EMPTY_INPUT エラー', async () => {
      const file = new File([], 'empty.jpg', { type: 'image/jpeg' });
      const result = await validateFile(file);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('EMPTY_INPUT');
      }
    });

    it('EMPTY_INPUT 時に message が含まれる', async () => {
      const blob = new Blob([]);
      const result = await validateFile(blob);
      if (!result.ok) {
        expect(result.message).toBeTruthy();
      }
    });
  });

  describe('TOO_LARGE エラー', () => {
    it('MAX_BLOB_SIZE_BYTES + 1 byte は TOO_LARGE エラー', async () => {
      // 実際に 50MB+ の Blob を作るのはメモリ不足になるため、
      // size プロパティをモックする方法を使用
      const oversizedBlob = {
        size: MAX_BLOB_SIZE_BYTES + 1,
        type: 'image/jpeg',
        slice: () => new Blob([]),
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        stream: () => new ReadableStream(),
      } as unknown as Blob;
      const result = await validateFile(oversizedBlob);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('TOO_LARGE');
      }
    });

    it('MAX_BLOB_SIZE_BYTES ちょうどは許可される (境界値)', async () => {
      // MAX_BLOB_SIZE_BYTES ちょうどのサイズ制限は超えていない
      // 内容が有効な画像でないため INVALID_FORMAT になる
      const atLimitBlob = {
        size: MAX_BLOB_SIZE_BYTES,
        type: 'application/octet-stream',
        slice: (_start?: number, _end?: number) => new Blob([new Uint8Array(4)]),
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        stream: () => new ReadableStream(),
      } as unknown as Blob;
      const result = await validateFile(atLimitBlob);
      // サイズ制限は通過するが magic bytes チェックで失敗するはず
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_FORMAT');
      }
    });

    it('TOO_LARGE 時に message が含まれる', async () => {
      const oversizedBlob = {
        size: MAX_BLOB_SIZE_BYTES + 1,
        type: 'image/jpeg',
        slice: () => new Blob([]),
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        stream: () => new ReadableStream(),
      } as unknown as Blob;
      const result = await validateFile(oversizedBlob);
      if (!result.ok) {
        expect(result.message).toBeTruthy();
      }
    });
  });

  describe('INVALID_FORMAT エラー', () => {
    it('ゴミデータ (4 bytes garbage) は INVALID_FORMAT エラー', async () => {
      const blob = new Blob([new Uint8Array([0xde, 0xad, 0xbe, 0xef])]);
      const result = await validateFile(blob);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_FORMAT');
      }
    });

    it('テキストファイルは INVALID_FORMAT エラー', async () => {
      const blob = new Blob(['hello world'], { type: 'text/plain' });
      const result = await validateFile(blob);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_FORMAT');
      }
    });

    it('INVALID_FORMAT 時に message が含まれる', async () => {
      const blob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])]);
      const result = await validateFile(blob);
      if (!result.ok) {
        expect(result.message).toBeTruthy();
      }
    });
  });

  describe('エラー優先順位: EMPTY_INPUT > TOO_LARGE > INVALID_FORMAT', () => {
    it('空ファイルは EMPTY_INPUT が優先される', async () => {
      const blob = new Blob([]);
      const result = await validateFile(blob);
      if (!result.ok) {
        expect(result.code).toBe('EMPTY_INPUT');
      }
    });
  });
});
