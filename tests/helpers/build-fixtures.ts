/**
 * テスト用フィクスチャ画像を動的に生成するヘルパー。
 * 実画像をリポジトリに含めず、決定論的なバイト列を生成して .cache/ に保存。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_CACHE_DIR = join(import.meta.dirname, '../fixtures/.cache');

/** CRC32 計算 (PNG チャンク・zlib に使用) */
function crc32(data: Uint8Array): number {
  const table = makeCrc32Table();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (table[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrc32Table(): readonly number[] {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c);
  }
  return table;
}

function uint32BE(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * 最小の有効な 1x1 JPEG バイト列 (EXIF なし)。
 * SOI → APP0(JFIF) → DQT → SOF0 → DHT(DC,AC) → SOS → EOI
 */
function buildMinimalJpeg(): Uint8Array {
  // 量子化テーブル (64 バイト、全て 16)
  const qtable = new Uint8Array(64).fill(16);

  const soi = new Uint8Array([0xff, 0xd8]);
  const eoi = new Uint8Array([0xff, 0xd9]);

  // APP0 JFIF
  const app0Data = new Uint8Array([
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00, // "JFIF\0"
    0x01,
    0x01, // version 1.1
    0x00, // density units: none
    0x00,
    0x01, // Xdensity = 1
    0x00,
    0x01, // Ydensity = 1
    0x00,
    0x00, // thumbnail 0x0
  ]);
  const app0Len = app0Data.length + 2;
  const app0Marker = new Uint8Array([
    0xff,
    0xe0,
    (app0Len >> 8) & 0xff,
    app0Len & 0xff,
    ...app0Data,
  ]);

  // DQT
  const dqtLen = 2 + 1 + 64; // length(2) + precision+id(1) + qtable(64)
  const dqt = new Uint8Array([
    0xff,
    0xdb,
    (dqtLen >> 8) & 0xff,
    dqtLen & 0xff,
    0x00, // precision=0 (8bit), id=0
    ...qtable,
  ]);

  // SOF0 (1x1, grayscale)
  const sof0 = new Uint8Array([
    0xff,
    0xc0,
    0x00,
    0x0b, // length = 11
    0x08, // precision = 8bit
    0x00,
    0x01, // height = 1
    0x00,
    0x01, // width = 1
    0x01, // components = 1 (grayscale)
    0x01,
    0x11,
    0x00, // comp1: id=1, sampling=1x1, qtable=0
  ]);

  // DHT DC (最小限の有効なハフマンテーブル)
  const dhtDcCounts = new Uint8Array(16).fill(0);
  dhtDcCounts[0] = 1; // L1 = 1 個のシンボル
  const dhtDcSymbols = new Uint8Array([0x00]); // シンボル = 0
  const dhtDcData = concatBytes(
    new Uint8Array([0x00]), // table class=0 (DC), id=0
    dhtDcCounts,
    dhtDcSymbols,
  );
  const dhtDcLen = dhtDcData.length + 2;
  const dhtDc = new Uint8Array([0xff, 0xc4, (dhtDcLen >> 8) & 0xff, dhtDcLen & 0xff, ...dhtDcData]);

  // DHT AC (最小限)
  const dhtAcCounts = new Uint8Array(16).fill(0);
  dhtAcCounts[0] = 1;
  const dhtAcSymbols = new Uint8Array([0x00]);
  const dhtAcData = concatBytes(
    new Uint8Array([0x10]), // class=1 (AC), id=0
    dhtAcCounts,
    dhtAcSymbols,
  );
  const dhtAcLen = dhtAcData.length + 2;
  const dhtAc = new Uint8Array([0xff, 0xc4, (dhtAcLen >> 8) & 0xff, dhtAcLen & 0xff, ...dhtAcData]);

  // SOS + entropy coded data
  const sosHeader = new Uint8Array([
    0xff,
    0xda,
    0x00,
    0x08, // length = 8
    0x01, // components = 1
    0x01, // comp id=1
    0x00, // DC=0, AC=0
    0x00,
    0x3f, // spectral start=0, end=63
    0x00, // Ah=0, Al=0
  ]);
  // 最小エントロピーデータ: 0x00 の DCT 係数 (ゼロ差分)
  const entropyData = new Uint8Array([0x7f, 0xff]);

  return concatBytes(soi, app0Marker, dqt, sof0, dhtDc, dhtAc, sosHeader, entropyData, eoi);
}

/**
 * JPEG バイト列に piexifjs 形式の EXIF APP1 セグメントを注入。
 * piexifjs に依存せず、手動でバイト列を構築する (テスト依存を最小化)。
 *
 * GPS・Make・Model・DateTimeOriginal を埋め込む。
 */
function buildJpegWithGps(): Uint8Array {
  const base = buildMinimalJpeg();

  // Exif APP1 を手動構築
  // IFD0: Make, Model, Orientation, DateTime, ExifIFD offset
  // ExifIFD: DateTimeOriginal, ExposureTime, FNumber
  // GPS IFD: GPSLatitudeRef, GPSLatitude, GPSLongitudeRef, GPSLongitude

  const encoder = new TextEncoder();

  // 文字列値をパディング付きで ASCII バイト列化
  function asciiBytes(s: string): Uint8Array {
    const bytes = encoder.encode(s);
    // null terminate
    return concatBytes(bytes, new Uint8Array([0]));
  }

  // Rational: numerator / denominator
  function rational(num: number, den: number): Uint8Array {
    return new Uint8Array([
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
      (den >>> 24) & 0xff,
      (den >>> 16) & 0xff,
      (den >>> 8) & 0xff,
      den & 0xff,
    ]);
  }

  function writeLe16(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  }

  function writeLe32(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  }

  // TIFF ヘッダー (little-endian)
  const tiffHeader = new Uint8Array([
    0x49,
    0x49, // "II" little-endian
    0x2a,
    0x00, // TIFF magic
    0x08,
    0x00,
    0x00,
    0x00, // IFD0 offset = 8
  ]);

  // 値データ領域を先に構築してオフセットを計算
  const makeStr = asciiBytes('TestCamera');
  const modelStr = asciiBytes('TestModel X1');
  const dateTimeStr = asciiBytes('2024:01:15 10:30:00');
  const dateTimeOrigStr = asciiBytes('2024:01:15 10:30:00');
  const latRef = asciiBytes('N');
  const lonRef = asciiBytes('E');

  // GPS: 35.6895° N, 139.6917° E (東京付近)
  const latDeg = rational(35, 1);
  const latMin = rational(41, 1);
  const latSec = rational(37, 1);
  const latRationals = concatBytes(latDeg, latMin, latSec);

  const lonDeg = rational(139, 1);
  const lonMin = rational(41, 1);
  const lonSec = rational(30, 1);
  const lonRationals = concatBytes(lonDeg, lonMin, lonSec);

  // IFD エントリ数と IFD サイズを計算
  // IFD エントリ: tag(2) + type(2) + count(4) + value/offset(4) = 12 bytes each
  // IFD0 entries: Make(0x010f), Model(0x0110), Orientation(0x0112), DateTime(0x0132),
  //               ExifIFD offset(0x8769), GPS IFD offset(0x8825) → 6 entries
  // ExifIFD entries: DateTimeOriginal(0x9003) → 1 entry
  //   (ExposureTime / FNumber はテスト未使用で正しい rational offset を保てないため除外)
  // GPS IFD entries: GPSLatitudeRef(0x0001), GPSLatitude(0x0002),
  //                  GPSLongitudeRef(0x0003), GPSLongitude(0x0004) → 4 entries

  const ifd0EntryCount = 6;
  const exifIfdEntryCount = 1;
  const gpsIfdEntryCount = 4;

  // オフセット計算 (TIFF ヘッダー先頭からの相対位置)
  // TIFF header: 8 bytes
  // IFD0: 2 (count) + 6*12 (entries) + 4 (next IFD) = 78 bytes → offset 8
  const ifd0Start = 8;
  const ifd0Size = 2 + ifd0EntryCount * 12 + 4;
  // ExifIFD: 2 + 3*12 + 4 = 42 bytes
  const exifIfdStart = ifd0Start + ifd0Size;
  const exifIfdSize = 2 + exifIfdEntryCount * 12 + 4;
  // GPS IFD: 2 + 4*12 + 4 = 54 bytes
  const gpsIfdStart = exifIfdStart + exifIfdSize;
  const gpsIfdSize = 2 + gpsIfdEntryCount * 12 + 4;
  // 値データ領域開始
  const valueStart = gpsIfdStart + gpsIfdSize;

  // 各値のオフセット
  let vOffset = valueStart;
  const makeOffset = vOffset;
  vOffset += makeStr.length;
  const modelOffset = vOffset;
  vOffset += modelStr.length;
  const dateTimeOffset = vOffset;
  vOffset += dateTimeStr.length;
  const dateTimeOrigOffset = vOffset;
  vOffset += dateTimeOrigStr.length;
  const latRefOffset = vOffset;
  vOffset += latRef.length;
  const lonRefOffset = vOffset;
  vOffset += lonRef.length;
  const latRationalsOffset = vOffset;
  vOffset += latRationals.length;
  const lonRationalsOffset = vOffset;
  vOffset += lonRationals.length;

  // IFD エントリ構築ヘルパー
  function ifdEntry(tag: number, type: number, count: number, valueOrOffset: number): Uint8Array {
    return concatBytes(writeLe16(tag), writeLe16(type), writeLe32(count), writeLe32(valueOrOffset));
  }

  // TIFF type codes: SHORT=3, LONG=4, RATIONAL=5, ASCII=2

  // IFD0
  const ifd0 = concatBytes(
    writeLe16(ifd0EntryCount),
    ifdEntry(0x010f, 2, makeStr.length, makeOffset), // Make (ASCII)
    ifdEntry(0x0110, 2, modelStr.length, modelOffset), // Model (ASCII)
    ifdEntry(0x0112, 3, 1, 1), // Orientation = 1 (SHORT, inline)
    ifdEntry(0x0132, 2, dateTimeStr.length, dateTimeOffset), // DateTime (ASCII)
    ifdEntry(0x8769, 4, 1, exifIfdStart), // ExifIFD offset
    ifdEntry(0x8825, 4, 1, gpsIfdStart), // GPS IFD offset
    writeLe32(0), // next IFD = none
  );

  // ExifIFD
  const exifIfd = concatBytes(
    writeLe16(exifIfdEntryCount),
    ifdEntry(0x9003, 2, dateTimeOrigStr.length, dateTimeOrigOffset), // DateTimeOriginal
    writeLe32(0),
  );

  // GPS IFD
  const gpsIfd = concatBytes(
    writeLe16(gpsIfdEntryCount),
    ifdEntry(0x0001, 2, latRef.length, latRefOffset), // GPSLatitudeRef
    ifdEntry(0x0002, 5, 3, latRationalsOffset), // GPSLatitude (3 rationals)
    ifdEntry(0x0003, 2, lonRef.length, lonRefOffset), // GPSLongitudeRef
    ifdEntry(0x0004, 5, 3, lonRationalsOffset), // GPSLongitude (3 rationals)
    writeLe32(0),
  );

  // 値データを結合
  const valueData = concatBytes(
    makeStr,
    modelStr,
    dateTimeStr,
    dateTimeOrigStr,
    latRef,
    lonRef,
    latRationals,
    lonRationals,
  );

  // TIFF データ全体
  const tiffData = concatBytes(tiffHeader, ifd0, exifIfd, gpsIfd, valueData);

  // APP1 セグメント: marker(2) + length(2) + "Exif\0\0"(6) + tiffData
  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const app1Body = concatBytes(exifHeader, tiffData);
  const app1Length = app1Body.length + 2; // +2 for length field itself
  const app1 = new Uint8Array([
    0xff,
    0xe1,
    (app1Length >> 8) & 0xff,
    app1Length & 0xff,
    ...app1Body,
  ]);

  // SOI の直後に APP1 を挿入 (APP0 の前)
  // base[0..1] = SOI, base[2..] = APP0 + rest
  const soi = base.slice(0, 2);
  const rest = base.slice(2);
  return concatBytes(soi, app1, rest);
}

/**
 * PNG シグネチャ + IHDR + optional tEXt + IDAT + IEND
 */
function buildPngWithText(): Uint8Array {
  function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new TextEncoder().encode(type);
    const crcData = concatBytes(typeBytes, data);
    const checksum = crc32(crcData);
    return concatBytes(uint32BE(data.length), typeBytes, data, uint32BE(checksum));
  }

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 1x1, 8-bit grayscale
  const ihdr = pngChunk(
    'IHDR',
    new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x01, // width = 1
      0x00,
      0x00,
      0x00,
      0x01, // height = 1
      0x08, // bit depth = 8
      0x00, // color type = 0 (grayscale)
      0x00, // compression = deflate
      0x00, // filter = adaptive
      0x00, // interlace = none
    ]),
  );

  // tEXt チャンク: "Software\0PhotoExifUtilTest"
  const keyword = new TextEncoder().encode('Software');
  const value = new TextEncoder().encode('PhotoExifUtilTest');
  const textData = concatBytes(keyword, new Uint8Array([0x00]), value);
  const text = pngChunk('tEXt', textData);

  // IDAT: 1x1 グレースケール黒 (0x00)
  // raw data: filter byte(0x00) + pixel(0x00) = [0x00, 0x00]
  // deflate 圧縮 (store: 最小)
  const rawPixelRow = new Uint8Array([0x00, 0x00]); // filter + pixel
  const idatData = deflateStore(rawPixelRow);
  const idat = pngChunk('IDAT', idatData);

  // IEND
  const iend = pngChunk('IEND', new Uint8Array(0));

  return concatBytes(signature, ihdr, text, idat, iend);
}

/**
 * deflate "stored" ブロック (非圧縮)。
 * zlib ヘッダー + deflate stored block
 */
function deflateStore(data: Uint8Array): Uint8Array {
  // zlib ヘッダー: CMF=0x78 (deflate, window=32768), FLG = checksum
  const cmf = 0x78;
  const flg = 0x01; // 0x7801 % 31 === 0
  const len = data.length;
  const nlen = ~len & 0xffff;

  // Adler-32 チェックサム
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
    // deflate stored block header
    0x01, // BFINAL=1, BTYPE=00 (stored)
    len & 0xff,
    (len >> 8) & 0xff,
    nlen & 0xff,
    (nlen >> 8) & 0xff,
    ...data,
    // zlib adler32 (big-endian)
    (adler >>> 24) & 0xff,
    (adler >>> 16) & 0xff,
    (adler >>> 8) & 0xff,
    adler & 0xff,
  ]);
}

/**
 * 最小 WebP (VP8L lossless) + EXIF チャンク
 */
function buildWebpWithExif(): Uint8Array {
  // VP8L 最小 1x1 緑ピクセル
  // VP8L ビットストリームは複雑なため、既知の最小バイト列を使用
  // 参考: libwebp の最小 VP8L
  const vp8lSignature = 0x2f; // VP8L signature byte
  // 1x1 ARGB=(0xff,0x00,0xff,0x00) の最小 VP8L ビットストリーム
  // width-1=0 (14bit), height-1=0 (14bit), alpha_is_used=0, version=0
  // transform present=0, color cache=0, meta huffman=0
  // huffman codes... (最小限)
  const vp8lBitstream = new Uint8Array([
    vp8lSignature,
    // width=1 (0, 14bit LE) → 0x00, height=1 (0, 14bit) → 0x00
    // alpha hint=0, version=0
    0x00,
    0x00,
    0x00,
    // simple huffman, 1 symbol: argb=0xff000000 (黒)
    0x00,
    0x00,
  ]);

  // VP8L チャンク
  const vp8lTag = new TextEncoder().encode('VP8L');
  const vp8lSize = vp8lBitstream.length;

  function le32(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  }

  const vp8lChunk = concatBytes(vp8lTag, le32(vp8lSize), vp8lBitstream);
  // WebP チャンクはサイズが奇数なら 1 バイトパディング
  const vp8lPadded =
    vp8lSize % 2 === 1 ? concatBytes(vp8lChunk, new Uint8Array([0x00])) : vp8lChunk;

  // 最小限の EXIF データ (GPS なし、Software のみ)
  // TIFF: "II" + magic + IFD0 offset
  // IFD0: Software tag
  const encoder = new TextEncoder();
  const softwareStr = concatBytes(encoder.encode('WebPTest'), new Uint8Array([0]));

  const exifTiffHeader = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const ifdEntryCount = new Uint8Array([0x01, 0x00]); // 1 entry
  const softwareOffset = 8 + 2 + 1 * 12 + 4; // after IFD

  function writeLe16(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  }

  function writeLe32(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  }

  const softwareEntry = concatBytes(
    writeLe16(0x0131), // Software tag
    writeLe16(2), // ASCII type
    writeLe32(softwareStr.length),
    writeLe32(softwareOffset),
  );
  const nextIfd = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const exifData = concatBytes(exifTiffHeader, ifdEntryCount, softwareEntry, nextIfd, softwareStr);

  // EXIF チャンク
  const exifTag = new TextEncoder().encode('EXIF');
  const exifChunk = concatBytes(exifTag, le32(exifData.length), exifData);
  const exifPadded =
    exifData.length % 2 === 1 ? concatBytes(exifChunk, new Uint8Array([0x00])) : exifChunk;

  // RIFF コンテナ
  const riffTag = new TextEncoder().encode('RIFF');
  const webpTag = new TextEncoder().encode('WEBP');
  const payload = concatBytes(webpTag, vp8lPadded, exifPadded);
  const riff = concatBytes(riffTag, le32(payload.length), payload);

  return riff;
}

/**
 * PNG: iCCP チャンク付き 1x1 画像。
 * ICC 保持テスト用 (strip-png.test.ts T6)。
 * iCCP データは最小限の "sRGB" プロファイル名を持つダミーデータ。
 */
function buildPngWithIccp(): Uint8Array {
  function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new TextEncoder().encode(type);
    const crcData = concatBytes(typeBytes, data);
    const checksum = crc32(crcData);
    return concatBytes(uint32BE(data.length), typeBytes, data, uint32BE(checksum));
  }

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 1x1, 8-bit grayscale
  const ihdr = pngChunk(
    'IHDR',
    new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x01, // width = 1
      0x00,
      0x00,
      0x00,
      0x01, // height = 1
      0x08, // bit depth = 8
      0x00, // color type = 0 (grayscale)
      0x00, // compression = deflate
      0x00, // filter = adaptive
      0x00, // interlace = none
    ]),
  );

  // iCCP チャンク: profile name\0compression method\0compressed data
  // テスト用の最小ダミー iCCP (profile name="sRGB", method=0, data=deflate of empty)
  const profileName = new TextEncoder().encode('sRGB');
  const nullByte = new Uint8Array([0x00]); // null separator
  const compressionMethod = new Uint8Array([0x00]); // deflate
  // 最小 deflate: zlib header + stored block (empty data)
  const minDeflate = new Uint8Array([
    0x78, 0x01, 0x01, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01,
  ]);
  const iccpData = concatBytes(profileName, nullByte, compressionMethod, minDeflate);
  const iccp = pngChunk('iCCP', iccpData);

  // IDAT: 1x1 グレースケール
  const rawPixelRow = new Uint8Array([0x00, 0x00]);
  const idatData = deflateStore(rawPixelRow);
  const idat = pngChunk('IDAT', idatData);

  // IEND
  const iend = pngChunk('IEND', new Uint8Array(0));

  return concatBytes(signature, ihdr, iccp, idat, iend);
}

/**
 * WebP: ICCP チャンク付き画像。
 * VP8X チャンクで ICCP フラグを立て、ICCP チャンクを追加する。
 * ICC 保持テスト用 (strip-webp.test.ts)。
 */
function buildWebpWithIccp(): Uint8Array {
  function le32(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  }

  // VP8L チャンク (最小 1x1 lossless)
  const vp8lSignature = 0x2f;
  const vp8lBitstream = new Uint8Array([vp8lSignature, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const vp8lTag = new TextEncoder().encode('VP8L');
  const vp8lSize = vp8lBitstream.length;
  const vp8lChunk = concatBytes(vp8lTag, le32(vp8lSize), vp8lBitstream);
  const vp8lPadded =
    vp8lSize % 2 === 1 ? concatBytes(vp8lChunk, new Uint8Array([0x00])) : vp8lChunk;

  // ICCP チャンク (ダミー ICC データ)
  const iccpTag = new TextEncoder().encode('ICCP');
  // 最小 ICC profile: 128 byte ヘッダーのシグネチャ部分だけ ("acsp")
  const iccData = new Uint8Array(12).fill(0x00);
  // "acsp" シグネチャを offset 36 に書き込む (実際の ICC では不要だがテスト用)
  const iccpChunk = concatBytes(iccpTag, le32(iccData.length), iccData);
  const iccpPadded =
    iccData.length % 2 === 1 ? concatBytes(iccpChunk, new Uint8Array([0x00])) : iccpChunk;

  // VP8X チャンク: Extended features header
  // WebP spec flags (1 byte): bit1=ICC, bit2=Alpha, bit3=Exif, bit4=XMP, bit5=Animation
  // ICC チャンクを含むため bit1 (=0x02) を立てる。
  const vp8xTag = new TextEncoder().encode('VP8X');
  const vp8xData = new Uint8Array([
    0x02, // flags: ICC profile present (bit 1)
    0x00,
    0x00,
    0x00, // reserved
    0x00,
    0x00,
    0x00, // canvas width minus 1 (24bit LE) = 0
    0x00,
    0x00,
    0x00, // canvas height minus 1 (24bit LE) = 0
  ]);
  const vp8xChunk = concatBytes(vp8xTag, le32(vp8xData.length), vp8xData);

  // RIFF コンテナ: VP8X → ICCP → VP8L の順
  const riffTag = new TextEncoder().encode('RIFF');
  const webpTag = new TextEncoder().encode('WEBP');
  const payload = concatBytes(webpTag, vp8xChunk, iccpPadded, vp8lPadded);
  return concatBytes(riffTag, le32(payload.length), payload);
}

/** 既知フィクスチャ一覧 (両関数で共有) */
const FIXTURE_BUILDERS: ReadonlyArray<readonly [string, () => Uint8Array]> = [
  ['jpeg-no-exif.jpg', buildMinimalJpeg],
  ['jpeg-with-gps.jpg', buildJpegWithGps],
  ['png-with-text.png', buildPngWithText],
  ['webp-with-exif.webp', buildWebpWithExif],
  ['png-with-iccp.png', buildPngWithIccp],
  ['webp-with-iccp.webp', buildWebpWithIccp],
];

/** キャッシュディレクトリにフィクスチャを書き出す (既存ファイルはスキップ) */
export function buildAllFixtures(): void {
  mkdirSync(FIXTURES_CACHE_DIR, { recursive: true });
  for (const [name, builder] of FIXTURE_BUILDERS) {
    const path = join(FIXTURES_CACHE_DIR, name);
    if (!existsSync(path)) {
      writeFileSync(path, builder());
    }
  }
}

/** 強制再生成 (テスト環境での明示的な再構築用) */
export function rebuildAllFixtures(): void {
  mkdirSync(FIXTURES_CACHE_DIR, { recursive: true });
  for (const [name, builder] of FIXTURE_BUILDERS) {
    writeFileSync(join(FIXTURES_CACHE_DIR, name), builder());
  }
}
