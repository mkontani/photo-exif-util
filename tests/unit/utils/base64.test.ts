import { arrayBufferToBase64, base64ToUint8Array } from '@/utils/base64';
import { describe, expect, it } from 'vitest';

describe('arrayBufferToBase64', () => {
  it('空の ArrayBuffer → 空文字', () => {
    const buf = new ArrayBuffer(0);
    expect(arrayBufferToBase64(buf)).toBe('');
  });

  it('"hello" のエンコード → "aGVsbG8="', () => {
    const encoder = new TextEncoder();
    const buf = encoder.encode('hello').buffer;
    expect(arrayBufferToBase64(buf)).toBe('aGVsbG8=');
  });

  it('バイナリデータ [0xff, 0x00, 0xab] → base64 文字列', () => {
    const buf = new Uint8Array([0xff, 0x00, 0xab]).buffer;
    const result = arrayBufferToBase64(buf);
    // btoa('\xff\x00\xab') = '/wCr'
    expect(result).toBe('/wCr');
  });

  it('返り値は ASCII 文字列のみ (base64 文字集合)', () => {
    const encoder = new TextEncoder();
    const buf = encoder.encode('test data for base64').buffer;
    const result = arrayBufferToBase64(buf);
    expect(result).toMatch(/^[A-Za-z0-9+/]*(={0,2})$/);
  });

  it('1 バイトデータ', () => {
    const buf = new Uint8Array([65]).buffer; // 'A'
    expect(arrayBufferToBase64(buf)).toBe('QQ==');
  });

  it('2 バイトデータ', () => {
    const buf = new Uint8Array([65, 66]).buffer; // 'AB'
    expect(arrayBufferToBase64(buf)).toBe('QUI=');
  });
});

describe('base64ToUint8Array', () => {
  it('空文字 → 空の Uint8Array', () => {
    const result = base64ToUint8Array('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it('"aGVsbG8=" → "hello" の bytes', () => {
    const result = base64ToUint8Array('aGVsbG8=');
    const decoder = new TextDecoder();
    expect(decoder.decode(result)).toBe('hello');
  });

  it('バイナリ round-trip: [0xff, 0x00, 0xab]', () => {
    const original = new Uint8Array([0xff, 0x00, 0xab]);
    const base64 = arrayBufferToBase64(original.buffer);
    const restored = base64ToUint8Array(base64);
    expect(restored).toEqual(original);
  });
});

describe('arrayBufferToBase64 + base64ToUint8Array round-trip', () => {
  it('テキストデータの round-trip', () => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode('Photo EXIF Util テスト');
    // TextEncoder.encode() の buffer は jsdom 環境では共有バッファになる場合があるため
    // 明示的に slice() して独立した ArrayBuffer にする
    const original = new Uint8Array(encoded.buffer.slice(0, encoded.byteLength));
    const base64 = arrayBufferToBase64(original.buffer);
    const restored = base64ToUint8Array(base64);
    expect(restored).toEqual(original);
  });

  it('大きなバイナリデータの round-trip (1024 バイト)', () => {
    const original = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) {
      original[i] = i % 256;
    }
    const base64 = arrayBufferToBase64(original.buffer);
    const restored = base64ToUint8Array(base64);
    expect(restored).toEqual(original);
  });

  it('全バイト値 0-255 の round-trip', () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      original[i] = i;
    }
    const base64 = arrayBufferToBase64(original.buffer);
    const restored = base64ToUint8Array(base64);
    expect(restored).toEqual(original);
  });
});
