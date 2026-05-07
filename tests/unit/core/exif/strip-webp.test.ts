import { stripWebp } from '@/core/exif/strip-webp';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

/** WebP RIFF チャンクを列挙する */
function listWebpChunks(
  bytes: Uint8Array,
): Array<{ fourCC: string; size: number; offset: number }> {
  const chunks: Array<{ fourCC: string; size: number; offset: number }> = [];
  // RIFF(4) + size(4) + WEBP(4) = 12 bytes header
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourCC = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );
    const size =
      (bytes[offset + 4] ?? 0) |
      ((bytes[offset + 5] ?? 0) << 8) |
      ((bytes[offset + 6] ?? 0) << 16) |
      ((bytes[offset + 7] ?? 0) << 24);
    chunks.push({ fourCC, size, offset });
    // パディング: size が奇数なら 1 byte 追加
    offset += 8 + size + (size % 2 === 1 ? 1 : 0);
  }
  return chunks;
}

/** RIFF ヘッダーの size フィールド (LE 4bytes, offset 4) を読む */
function readRiffSize(bytes: Uint8Array): number {
  return (
    (bytes[4] ?? 0) | ((bytes[5] ?? 0) << 8) | ((bytes[6] ?? 0) << 16) | ((bytes[7] ?? 0) << 24)
  );
}

describe('stripWebp', () => {
  describe('T1: EXIF チャンク削除', () => {
    it('EXIF チャンクが strip 後に存在しない', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      expect(chunks.some((c) => c.fourCC === 'EXIF')).toBe(false);
    });

    it('removedKeys に EXIF 系キーが含まれる', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      expect(result.removedKeys.length).toBeGreaterThan(0);
    });

    it('format が webp', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      expect(result.format).toBe('webp');
    });
  });

  describe('T2: RIFF コンテナサイズの正確性', () => {
    it('RIFF size header が payload の実サイズと一致する', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // RIFF size = total file size - 8 (RIFF tag + size field)
      const riffSize = readRiffSize(bytes);
      expect(riffSize).toBe(bytes.length - 8);
    });

    it('strip 後のファイルサイズが元より小さい (EXIF 削除分)', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      expect(result.blob.size).toBeLessThan(blob.size);
    });
  });

  describe('T3: VP8/VP8L/VP8X チャンク維持', () => {
    it('VP8L チャンクが残る (テストフィクスチャは VP8L)', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      // VP8L または VP8 のいずれかが残存
      const hasVp8 = chunks.some(
        (c) => c.fourCC === 'VP8L' || c.fourCC === 'VP8 ' || c.fourCC === 'VP8X',
      );
      expect(hasVp8).toBe(true);
    });
  });

  describe('T4: 偶数バイトパディング規則', () => {
    it('全チャンクが偶数バイトアライメントを守っている', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const size =
          (bytes[offset + 4] ?? 0) |
          ((bytes[offset + 5] ?? 0) << 8) |
          ((bytes[offset + 6] ?? 0) << 16) |
          ((bytes[offset + 7] ?? 0) << 24);
        // 奇数サイズなら次チャンクの前に 1 byte パディングがあるはず
        const paddedSize = size % 2 === 1 ? size + 1 : size;
        // 次のオフセットが有効範囲内なら fourCC が ASCII 文字のはず
        const nextOffset = offset + 8 + paddedSize;
        if (nextOffset < bytes.length) {
          // パディング確認: 奇数サイズの場合にパディングバイトが 0x00 か確認
          if (size % 2 === 1) {
            expect(bytes[offset + 8 + size]).toBe(0x00);
          }
        }
        offset += 8 + paddedSize;
      }
    });
  });

  describe('T5: WebP magic bytes 維持', () => {
    it('RIFF magic bytes (52 49 46 46) で開始する', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[0]).toBe(0x52); // R
      expect(bytes[1]).toBe(0x49); // I
      expect(bytes[2]).toBe(0x46); // F
      expect(bytes[3]).toBe(0x46); // F
    });

    it('WEBP magic bytes (57 45 42 50) がオフセット 8 に存在する', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[8]).toBe(0x57); // W
      expect(bytes[9]).toBe(0x45); // E
      expect(bytes[10]).toBe(0x42); // B
      expect(bytes[11]).toBe(0x50); // P
    });
  });

  describe('ICC 保持 (keep: [icc])', () => {
    it('keep: [icc] で ICCP チャンクが残る', async () => {
      const blob = loadFixtureAsBlob('webp-with-iccp.webp');
      const result = await stripWebp(blob, { keep: ['icc'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      expect(chunks.some((c) => c.fourCC === 'ICCP')).toBe(true);
    });

    it('remove: all で ICCP チャンクが削除される', async () => {
      const blob = loadFixtureAsBlob('webp-with-iccp.webp');
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      expect(chunks.some((c) => c.fourCC === 'ICCP')).toBe(false);
    });

    it('remove: [gps] (非 icc) で ICCP チャンクは保持される', async () => {
      const blob = loadFixtureAsBlob('webp-with-iccp.webp');
      const result = await stripWebp(blob, { remove: ['gps'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      expect(chunks.some((c) => c.fourCC === 'ICCP')).toBe(true);
    });

    it('options 未指定でも VP8L チャンクは残る', async () => {
      const blob = loadFixtureAsBlob('webp-with-iccp.webp');
      const result = await stripWebp(blob);
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      expect(
        chunks.some((c) => c.fourCC === 'VP8L' || c.fourCC === 'VP8 ' || c.fourCC === 'VP8X'),
      ).toBe(true);
    });

    it('keep: [icc] 指定で ICC 以外のメタチャンクは削除される', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await stripWebp(blob, { keep: ['icc'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      expect(chunks.some((c) => c.fourCC === 'EXIF')).toBe(false);
    });
  });

  describe('ancillary/unknown チャンクの保持 (カバレッジ)', () => {
    it('RIFF に未知のチャンク (UNKN) が含まれている場合は保持される', async () => {
      // VP8L + UNKN + EXIF を含む WebP を手動構築
      function le32(n: number): Uint8Array {
        return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
      }
      function makeChunk(fourCC: string, data: Uint8Array): Uint8Array {
        const tag = new TextEncoder().encode(fourCC);
        const size = data.length;
        const padding = size % 2 === 1 ? 1 : 0;
        const result = new Uint8Array(8 + size + padding);
        result.set(tag, 0);
        result.set(le32(size), 4);
        result.set(data, 8);
        return result;
      }

      const vp8lBitstream = new Uint8Array([0x2f, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const vp8l = makeChunk('VP8L', vp8lBitstream);
      const unkn = makeChunk('UNKN', new Uint8Array([0x01, 0x02, 0x03]));
      const exifTiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const exifChunk = makeChunk('EXIF', exifTiff);

      const riffTag = new TextEncoder().encode('RIFF');
      const webpTag = new TextEncoder().encode('WEBP');
      const payload = new Uint8Array(webpTag.length + vp8l.length + unkn.length + exifChunk.length);
      let off = 0;
      payload.set(webpTag, off);
      off += webpTag.length;
      payload.set(vp8l, off);
      off += vp8l.length;
      payload.set(unkn, off);
      off += unkn.length;
      payload.set(exifChunk, off);

      const riff = new Uint8Array(8 + payload.length);
      riff.set(riffTag, 0);
      riff.set(le32(payload.length), 4);
      riff.set(payload, 8);

      const blob = new Blob([riff], { type: 'image/webp' });
      const result = await stripWebp(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listWebpChunks(bytes);
      // EXIF は削除される
      expect(chunks.some((c) => c.fourCC === 'EXIF')).toBe(false);
      // UNKN は保持される (ancillary chunk)
      expect(chunks.some((c) => c.fourCC === 'UNKN')).toBe(true);
    });
  });

  describe('VP8X フラグビット更新 (削除に応じてクリア)', () => {
    function le32(n: number): Uint8Array {
      return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
    }
    function makeChunk(fourCC: string, data: Uint8Array): Uint8Array {
      const tag = new TextEncoder().encode(fourCC);
      const size = data.length;
      const padding = size % 2 === 1 ? 1 : 0;
      const result = new Uint8Array(8 + size + padding);
      result.set(tag, 0);
      result.set(le32(size), 4);
      result.set(data, 8);
      return result;
    }
    /** flags=0x1A (ICC=bit1=0x02 + EXIF=bit3=0x08 + XMP=bit4=0x10) を立てた VP8X + 各メタを含む WebP */
    function buildWebpWithAllMeta(): Blob {
      const vp8xData = new Uint8Array([0x1a, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      const vp8x = makeChunk('VP8X', vp8xData);
      const iccp = makeChunk('ICCP', new Uint8Array([0xaa, 0xbb]));
      const vp8l = makeChunk('VP8L', new Uint8Array([0x2f, 0, 0, 0, 0, 0]));
      const exif = makeChunk('EXIF', new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0, 0, 0, 0, 0]));
      const xmp = makeChunk('XMP ', new Uint8Array([0x3c, 0x78, 0x3e])); // "<x>"

      const riff = new TextEncoder().encode('RIFF');
      const webp = new TextEncoder().encode('WEBP');
      const payload = new Uint8Array(
        webp.length + vp8x.length + iccp.length + vp8l.length + exif.length + xmp.length,
      );
      let off = 0;
      payload.set(webp, off);
      off += webp.length;
      payload.set(vp8x, off);
      off += vp8x.length;
      payload.set(iccp, off);
      off += iccp.length;
      payload.set(vp8l, off);
      off += vp8l.length;
      payload.set(exif, off);
      off += exif.length;
      payload.set(xmp, off);

      const out = new Uint8Array(8 + payload.length);
      out.set(riff, 0);
      out.set(le32(payload.length), 4);
      out.set(payload, 8);
      return new Blob([out], { type: 'image/webp' });
    }
    function getVp8xFlags(bytes: Uint8Array): number {
      const chunks = listWebpChunks(bytes);
      const vp8x = chunks.find((c) => c.fourCC === 'VP8X');
      if (!vp8x) return -1;
      // chunk data は header 8 byte の後ろから size バイト
      const dataStart = vp8x.offset + 8;
      return bytes[dataStart] ?? 0;
    }

    it('remove: all で VP8X の ICC/EXIF/XMP フラグが全てクリアされる', async () => {
      const blob = buildWebpWithAllMeta();
      const result = await stripWebp(blob, { remove: 'all' });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      const flags = getVp8xFlags(bytes);
      // 全フラグがクリア (0x00)
      expect(flags & 0b00011010).toBe(0);
    });

    it('remove: [gps, datetime] でも WebP は EXIF/XMP チャンクを一括削除し ICC のみ維持する', async () => {
      // WebP のメタはチャンクレベルでしか分離できない設計のため、
      // remove に 'icc' を含めない限り ICC は維持、EXIF/XMP は削除される。
      const blob = buildWebpWithAllMeta();
      const result = await stripWebp(blob, { remove: ['gps', 'datetime'] });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      const flags = getVp8xFlags(bytes);
      // 元 0x1A から EXIF (bit3) / XMP (bit4) クリア、ICC (bit1) 維持 → 0x02
      expect(flags).toBe(0x02);
    });

    it('keep: [icc] で EXIF/XMP のみ削除、ICC フラグは維持される', async () => {
      const blob = buildWebpWithAllMeta();
      const result = await stripWebp(blob, { keep: ['icc'] });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      const flags = getVp8xFlags(bytes);
      // EXIF/XMP クリア、ICC 維持
      expect(flags & 0b00010000).toBe(0); // XMP cleared
      expect(flags & 0b00001000).toBe(0); // EXIF cleared
      expect(flags & 0b00000010).toBe(0b00000010); // ICC retained
    });
  });
});
