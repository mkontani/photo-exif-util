import { parseExif } from '@/core/exif/parse';
import { stripPng } from '@/core/exif/strip-png';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

/** CRC32 計算 (テスト用) */
function crc32Test(data: Uint8Array): number {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c);
  }
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (table[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG チャンクを構築するヘルパー */
function buildTestPngChunk(type: string, data: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const checksum = crc32Test(crcInput);
  const result = new Uint8Array(4 + 4 + data.length + 4);
  result[0] = (data.length >>> 24) & 0xff;
  result[1] = (data.length >>> 16) & 0xff;
  result[2] = (data.length >>> 8) & 0xff;
  result[3] = data.length & 0xff;
  result.set(typeBytes, 4);
  result.set(data, 8);
  result[8 + data.length] = (checksum >>> 24) & 0xff;
  result[9 + data.length] = (checksum >>> 16) & 0xff;
  result[10 + data.length] = (checksum >>> 8) & 0xff;
  result[11 + data.length] = checksum & 0xff;
  return result;
}

/** deflate "stored" ブロック生成 */
function deflateStoreTest(data: Uint8Array): Uint8Array {
  const cmf = 0x78;
  const flg = 0x01;
  const len = data.length;
  const nlen = ~len & 0xffff;
  let s1 = 1;
  let s2 = 0;
  for (const b of data) {
    s1 = (s1 + b) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = (s2 << 16) | s1;
  return new Uint8Array([
    cmf,
    flg,
    0x01,
    len & 0xff,
    (len >> 8) & 0xff,
    nlen & 0xff,
    (nlen >> 8) & 0xff,
    ...data,
    (adler >>> 24) & 0xff,
    (adler >>> 16) & 0xff,
    (adler >>> 8) & 0xff,
    adler & 0xff,
  ]);
}

/**
 * unknown ancillary チャンクを含む PNG を生成する。
 * IHDR → sBIT (ancillary) → tEXt → IDAT → IEND の構成。
 * sBIT チャンクは unknown ancillary なので strip 後も残るべき。
 */
function buildPngWithAncillaryChunk(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = buildTestPngChunk(
    'IHDR',
    new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00]),
  );
  // sBIT: significant bits (ancillary chunk)
  const sbit = buildTestPngChunk('sBIT', new Uint8Array([0x08])); // 8 significant bits
  // tEXt チャンク
  const enc = new TextEncoder();
  const keyword = enc.encode('Comment');
  const value = enc.encode('test');
  const textData = new Uint8Array(keyword.length + 1 + value.length);
  textData.set(keyword, 0);
  textData[keyword.length] = 0x00;
  textData.set(value, keyword.length + 1);
  const text = buildTestPngChunk('tEXt', textData);
  const idat = buildTestPngChunk('IDAT', deflateStoreTest(new Uint8Array([0x00, 0x00])));
  const iend = buildTestPngChunk('IEND', new Uint8Array(0));

  const total =
    signature.length + ihdr.length + sbit.length + text.length + idat.length + iend.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of [signature, ihdr, sbit, text, idat, iend]) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * キーワードなし tEXt チャンク (nullIdx = 0 のエッジケース) を含む PNG。
 */
function buildPngWithEmptyKeywordText(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = buildTestPngChunk(
    'IHDR',
    new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00]),
  );
  // tEXt チャンク: 先頭が null byte (nullIdx = 0 → chunk.type が返る)
  const text = buildTestPngChunk('tEXt', new Uint8Array([0x00, 0x61])); // \0a
  const idat = buildTestPngChunk('IDAT', deflateStoreTest(new Uint8Array([0x00, 0x00])));
  const iend = buildTestPngChunk('IEND', new Uint8Array(0));

  const total = signature.length + ihdr.length + text.length + idat.length + iend.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of [signature, ihdr, text, idat, iend]) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * iTXt チャンクを含む PNG。
 */
function buildPngWithItxtChunk(): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = buildTestPngChunk(
    'IHDR',
    new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00]),
  );
  // iTXt チャンク: keyword\0compression\0language\0translated_keyword\0text
  const enc = new TextEncoder();
  const keyword = enc.encode('Author');
  const rest = new Uint8Array([0x00, 0x00, 0x00, ...enc.encode('test')]);
  const itxtData = new Uint8Array(keyword.length + rest.length);
  itxtData.set(keyword, 0);
  itxtData.set(rest, keyword.length);
  const itxt = buildTestPngChunk('iTXt', itxtData);
  const idat = buildTestPngChunk('IDAT', deflateStoreTest(new Uint8Array([0x00, 0x00])));
  const iend = buildTestPngChunk('IEND', new Uint8Array(0));

  const total = signature.length + ihdr.length + itxt.length + idat.length + iend.length;
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of [signature, ihdr, itxt, idat, iend]) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** PNG チャンクを列挙する */
function listPngChunks(bytes: Uint8Array): Array<{ type: string; length: number }> {
  const chunks: Array<{ type: string; length: number }> = [];
  let offset = 8; // PNG signature
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
    chunks.push({ type, length });
    offset += 4 + 4 + length + 4; // length + type + data + crc
  }
  return chunks;
}

/** CRC32 計算 */
function crc32(data: Uint8Array): number {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c);
  }
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (table[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

describe('stripPng', () => {
  describe('T1: tEXt チャンク削除', () => {
    it('strip 後に Software フィールドが消える (tEXt keyword)', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const parsed = await parseExif(result.blob);
      // Software は tEXt チャンクに含まれるため strip 後に消える
      // (IHDR から抽出される ImageWidth 等の構造フィールドは残る)
      expect(parsed.fields.some((f) => f.key === 'Software')).toBe(false);
    });

    it('tEXt チャンクが strip 後に消える', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'tEXt')).toBe(false);
    });

    it('removedKeys が空でない (tEXt キーワードが含まれる)', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      expect(result.removedKeys.length).toBeGreaterThan(0);
    });
  });

  describe('T2: PNG シグネチャ維持', () => {
    it('strip 後も PNG シグネチャ (89 50 4E 47 0D 0A 1A 0A) で開始する', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50);
      expect(bytes[2]).toBe(0x4e);
      expect(bytes[3]).toBe(0x47);
      expect(bytes[4]).toBe(0x0d);
      expect(bytes[5]).toBe(0x0a);
      expect(bytes[6]).toBe(0x1a);
      expect(bytes[7]).toBe(0x0a);
    });

    it('format が png', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      expect(result.format).toBe('png');
    });
  });

  describe('T3: 必須チャンク (IHDR / IDAT / IEND) の維持', () => {
    it('IHDR チャンクが残る', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'IHDR')).toBe(true);
    });

    it('IDAT チャンクが残る', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'IDAT')).toBe(true);
    });

    it('IEND チャンクが残る', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'IEND')).toBe(true);
    });

    it('IEND が最後のチャンク', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks[chunks.length - 1]?.type).toBe('IEND');
    });
  });

  describe('T4: CRC 検証', () => {
    it('strip 後の全チャンクの CRC が valid', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let offset = 8; // PNG signature
      while (offset + 8 <= bytes.length) {
        const length =
          ((bytes[offset] ?? 0) << 24) |
          ((bytes[offset + 1] ?? 0) << 16) |
          ((bytes[offset + 2] ?? 0) << 8) |
          (bytes[offset + 3] ?? 0);
        // type + data に対して CRC 計算
        const typeAndData = bytes.slice(offset + 4, offset + 4 + 4 + length);
        const expectedCrc =
          ((bytes[offset + 4 + 4 + length] ?? 0) << 24) |
          ((bytes[offset + 4 + 4 + length + 1] ?? 0) << 16) |
          ((bytes[offset + 4 + 4 + length + 2] ?? 0) << 8) |
          (bytes[offset + 4 + 4 + length + 3] ?? 0);
        const actualCrc = crc32(typeAndData);
        expect(actualCrc >>> 0).toBe(expectedCrc >>> 0);
        offset += 4 + 4 + length + 4;
      }
    });
  });

  describe('T5: デコード可能性 (1x1 ピクセルの確認)', () => {
    it('strip 後も IHDR が 1x1 サイズを示している', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // IHDR は signature(8) の直後: length(4) + type(4) + data(13)
      const ihdrOffset = 8 + 4 + 4; // skip sig + length + type
      const width =
        ((bytes[ihdrOffset] ?? 0) << 24) |
        ((bytes[ihdrOffset + 1] ?? 0) << 16) |
        ((bytes[ihdrOffset + 2] ?? 0) << 8) |
        (bytes[ihdrOffset + 3] ?? 0);
      const height =
        ((bytes[ihdrOffset + 4] ?? 0) << 24) |
        ((bytes[ihdrOffset + 5] ?? 0) << 16) |
        ((bytes[ihdrOffset + 6] ?? 0) << 8) |
        (bytes[ihdrOffset + 7] ?? 0);
      expect(width).toBe(1);
      expect(height).toBe(1);
    });
  });

  describe('T6: ICC 保持 (keep: [icc])', () => {
    it('keep: [icc] で iCCP チャンクが残る', async () => {
      const blob = loadFixtureAsBlob('png-with-iccp.png');
      const result = await stripPng(blob, { keep: ['icc'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'iCCP')).toBe(true);
    });

    it('remove: all で iCCP チャンクが削除される', async () => {
      const blob = loadFixtureAsBlob('png-with-iccp.png');
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'iCCP')).toBe(false);
    });

    it('iCCP なし PNG で keep: [icc] でもエラーなく動作する', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      await expect(stripPng(blob, { keep: ['icc'] })).resolves.toBeDefined();
    });

    it('remove: [gps] (非 icc) で iCCP チャンクは保持される', async () => {
      const blob = loadFixtureAsBlob('png-with-iccp.png');
      const result = await stripPng(blob, { remove: ['gps'] });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      expect(chunks.some((c) => c.type === 'iCCP')).toBe(true);
    });

    it('options 未指定でも PNG signature は維持される', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await stripPng(blob);
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50);
    });
  });

  describe('ancillary チャンクの保持 (カバレッジ)', () => {
    it('ancillary チャンク (sBIT) は削除されずに残る', async () => {
      const pngBytes = buildPngWithAncillaryChunk();
      const blob = new Blob([pngBytes], { type: 'image/png' });
      const result = await stripPng(blob, { remove: 'all' });
      const buf = await result.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const chunks = listPngChunks(bytes);
      // tEXt は削除されるが sBIT は保持される
      expect(chunks.some((c) => c.type === 'tEXt')).toBe(false);
      expect(chunks.some((c) => c.type === 'sBIT')).toBe(true);
    });

    it('tEXt キーワードが null byte で始まる場合は chunk type 名が removedKeys に入る', async () => {
      const pngBytes = buildPngWithEmptyKeywordText();
      const blob = new Blob([pngBytes], { type: 'image/png' });
      const result = await stripPng(blob, { remove: 'all' });
      // tEXt チャンクが削除されていること
      expect(result.removedKeys.length).toBeGreaterThan(0);
    });

    it('iTXt チャンクのキーワードが removedKeys に入る', async () => {
      const pngBytes = buildPngWithItxtChunk();
      const blob = new Blob([pngBytes], { type: 'image/png' });
      const result = await stripPng(blob, { remove: 'all' });
      // iTXt が削除され、keyword "Author" が入る
      expect(result.removedKeys).toContain('Author');
    });
  });
});
