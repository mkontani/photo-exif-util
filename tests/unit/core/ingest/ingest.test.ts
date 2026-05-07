import { MAX_BLOB_SIZE_BYTES } from '@/core/exif/parse';
import { ingest } from '@/core/ingest/ingest';
import type { IngestDeps } from '@/core/ingest/ingest';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

/** テスト用のデフォルト deps (fetchUrl は stub) */
function makeDeps(overrides?: Partial<IngestDeps>): IngestDeps {
  return {
    fetchUrl: vi.fn().mockResolvedValue(loadFixtureAsBlob('jpeg-with-gps.jpg')),
    ...overrides,
  };
}

describe('ingest', () => {
  describe('kind: file', () => {
    it('有効な JPEG File → IngestResult を返す', async () => {
      const file = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await ingest({ source: { kind: 'file', name: 'test.jpg' }, file }, makeDeps());
      expect(result.format).toBe('jpeg');
      expect(result.source.kind).toBe('file');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('有効な PNG File → IngestResult を返す', async () => {
      const file = loadFixtureAsBlob('png-with-text.png');
      const result = await ingest({ source: { kind: 'file', name: 'test.png' }, file }, makeDeps());
      expect(result.format).toBe('png');
    });

    it('有効な WebP File → IngestResult を返す', async () => {
      const file = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await ingest(
        { source: { kind: 'file', name: 'test.webp' }, file },
        makeDeps(),
      );
      expect(result.format).toBe('webp');
    });

    it('source が正しく伝播される', async () => {
      const file = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await ingest(
        { source: { kind: 'file', name: 'my-photo.jpg' }, file },
        makeDeps(),
      );
      expect(result.source).toEqual({ kind: 'file', name: 'my-photo.jpg' });
    });

    it('空ファイルは EMPTY_INPUT で reject される', async () => {
      const file = new Blob([]);
      await expect(
        ingest({ source: { kind: 'file', name: 'empty.jpg' }, file }, makeDeps()),
      ).rejects.toMatchObject({ code: 'EMPTY_INPUT' });
    });

    it('ゴミデータは INVALID_FORMAT で reject される', async () => {
      const file = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])]);
      await expect(
        ingest({ source: { kind: 'file', name: 'garbage.bin' }, file }, makeDeps()),
      ).rejects.toMatchObject({ code: 'INVALID_FORMAT' });
    });

    it('fetchUrl は file 取り込み時に呼ばれない', async () => {
      const file = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const fetchUrl = vi.fn();
      await ingest({ source: { kind: 'file', name: 'test.jpg' }, file }, { fetchUrl });
      expect(fetchUrl).not.toHaveBeenCalled();
    });

    it('サイズ超過ファイルは TOO_LARGE で reject され sizeBytes が設定される', async () => {
      const oversize = 50 * 1024 * 1024 + 1;
      const oversizedBlob = Object.create(Blob.prototype, {
        size: { value: oversize },
        type: { value: 'image/jpeg' },
        slice: { value: () => new Blob([]) },
      }) as Blob;
      await expect(
        ingest({ source: { kind: 'file', name: 'huge.jpg' }, file: oversizedBlob }, makeDeps()),
      ).rejects.toMatchObject({ code: 'TOO_LARGE', sizeBytes: oversize });
    });
  });

  describe('kind: drop', () => {
    it('有効な Blob (drop) → IngestResult を返す', async () => {
      const file = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await ingest(
        { source: { kind: 'drop', name: 'dropped.jpg' }, file },
        makeDeps(),
      );
      expect(result.format).toBe('jpeg');
      expect(result.source.kind).toBe('drop');
    });
  });

  describe('kind: url', () => {
    it('https URL + mock fetchUrl → IngestResult を返す', async () => {
      const mockBlob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const deps = makeDeps({ fetchUrl: vi.fn().mockResolvedValue(mockBlob) });
      const result = await ingest(
        { source: { kind: 'url', url: 'https://example.com/img.jpg' } },
        deps,
      );
      expect(result.format).toBe('jpeg');
      expect(result.source).toEqual({ kind: 'url', url: 'https://example.com/img.jpg' });
    });

    it('fetchUrl が呼ばれる', async () => {
      const mockBlob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const fetchUrl = vi.fn().mockResolvedValue(mockBlob);
      await ingest({ source: { kind: 'url', url: 'https://example.com/img.jpg' } }, { fetchUrl });
      expect(fetchUrl).toHaveBeenCalledWith('https://example.com/img.jpg');
    });

    it('http://localhost は BLOCKED_URL で reject される', async () => {
      await expect(
        ingest({ source: { kind: 'url', url: 'http://localhost' } }, makeDeps()),
      ).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    });

    it('Private IP は BLOCKED_URL で reject される', async () => {
      await expect(
        ingest({ source: { kind: 'url', url: 'https://192.168.0.1' } }, makeDeps()),
      ).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    });

    it('不正な URL は INVALID_URL で reject される', async () => {
      await expect(
        ingest({ source: { kind: 'url', url: 'not-a-url' } }, makeDeps()),
      ).rejects.toMatchObject({ code: 'INVALID_URL' });
    });

    it('fetchUrl が FETCH_FAILED を throw した場合、そのまま reject される', async () => {
      const fetchUrl = vi.fn().mockRejectedValue({
        code: 'FETCH_FAILED',
        message: 'HTTP 404',
        status: 404,
      });
      await expect(
        ingest({ source: { kind: 'url', url: 'https://example.com/notfound.jpg' } }, { fetchUrl }),
      ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
    });

    it('fetchUrl が返した blob のサイズが MAX_BLOB_SIZE_BYTES 超 → TOO_LARGE で reject', async () => {
      const oversizedBlob = {
        size: MAX_BLOB_SIZE_BYTES + 1,
        type: 'image/jpeg',
        slice: () => new Blob([]),
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        stream: () => new ReadableStream(),
      } as unknown as Blob;
      const deps = makeDeps({ fetchUrl: vi.fn().mockResolvedValue(oversizedBlob) });
      await expect(
        ingest({ source: { kind: 'url', url: 'https://example.com/huge.jpg' } }, deps),
      ).rejects.toMatchObject({ code: 'TOO_LARGE' });
    });

    it('fetchUrl が返した blob が不正フォーマット → INVALID_FORMAT で reject', async () => {
      const garbageBlob = new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x00])]);
      const deps = makeDeps({ fetchUrl: vi.fn().mockResolvedValue(garbageBlob) });
      await expect(
        ingest({ source: { kind: 'url', url: 'https://example.com/bad.bin' } }, deps),
      ).rejects.toMatchObject({ code: 'INVALID_FORMAT' });
    });

    it('allowHttp=true の場合 http スキームが許可される', async () => {
      const mockBlob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const deps = makeDeps({ fetchUrl: vi.fn().mockResolvedValue(mockBlob) });
      const result = await ingest(
        { source: { kind: 'url', url: 'http://example.com/img.jpg' } },
        deps,
        { allowHttp: true },
      );
      expect(result.format).toBe('jpeg');
    });
  });

  describe('kind: context-menu', () => {
    it('有効な srcUrl → IngestResult を返す', async () => {
      const mockBlob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const deps = makeDeps({ fetchUrl: vi.fn().mockResolvedValue(mockBlob) });
      const result = await ingest(
        {
          source: {
            kind: 'context-menu',
            pageUrl: 'https://example.com/',
            srcUrl: 'https://example.com/image.jpg',
          },
        },
        deps,
      );
      expect(result.format).toBe('jpeg');
      expect(result.source.kind).toBe('context-menu');
    });

    it('srcUrl が Private IP → BLOCKED_URL で reject される', async () => {
      await expect(
        ingest(
          {
            source: {
              kind: 'context-menu',
              pageUrl: 'https://example.com/',
              srcUrl: 'https://192.168.0.1/image.jpg',
            },
          },
          makeDeps(),
        ),
      ).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    });

    it('srcUrl が不正 URL → INVALID_URL で reject される', async () => {
      await expect(
        ingest(
          {
            source: {
              kind: 'context-menu',
              pageUrl: 'https://example.com/',
              srcUrl: 'not-a-url',
            },
          },
          makeDeps(),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_URL' });
    });

    it('fetchUrl に srcUrl が渡される', async () => {
      const mockBlob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const fetchUrl = vi.fn().mockResolvedValue(mockBlob);
      await ingest(
        {
          source: {
            kind: 'context-menu',
            pageUrl: 'https://example.com/',
            srcUrl: 'https://cdn.example.com/photo.jpg',
          },
        },
        { fetchUrl },
      );
      expect(fetchUrl).toHaveBeenCalledWith('https://cdn.example.com/photo.jpg');
    });

    it('ensureHostPermission が定義されていて false を返す → PERMISSION_DENIED で reject', async () => {
      const deps: IngestDeps = {
        fetchUrl: vi.fn(),
        ensureHostPermission: vi.fn().mockResolvedValue(false),
      };
      await expect(
        ingest(
          {
            source: {
              kind: 'context-menu',
              pageUrl: 'https://example.com/',
              srcUrl: 'https://cdn.example.com/photo.jpg',
            },
          },
          deps,
        ),
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });
  });
});
