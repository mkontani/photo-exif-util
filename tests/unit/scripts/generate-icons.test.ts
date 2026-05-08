/**
 * generate-icons スクリプトのユニットテスト。
 * generateSolidPng / generateCirclePng の純粋関数としての動作を検証する。
 */
import { describe, expect, it } from 'vitest';
import {
  generateCirclePng,
  generateSolidPng,
  parseForceFlag,
  shouldWriteIcon,
} from '../../../scripts/generate-icons';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe('generateSolidPng', () => {
  it('PNG シグネチャで始まる', () => {
    const png = generateSolidPng(1, 255, 0, 0, 255);
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
      expect(png[i]).toBe(PNG_SIGNATURE[i]);
    }
  });

  it('Uint8Array を返す', () => {
    const png = generateSolidPng(1, 0, 0, 0, 255);
    expect(png).toBeInstanceOf(Uint8Array);
  });

  it('サイズ 1 で最小の PNG を生成する', () => {
    const png = generateSolidPng(1, 0, 0, 0, 255);
    // PNG シグネチャ(8) + IHDR(25) + IDAT(可変) + IEND(12) の最低サイズ
    expect(png.length).toBeGreaterThan(50);
  });

  it('サイズが大きくなるにつれてバイト数が増加する', () => {
    const png16 = generateSolidPng(16, 0, 128, 255, 255);
    const png32 = generateSolidPng(32, 0, 128, 255, 255);
    const png48 = generateSolidPng(48, 0, 128, 255, 255);
    expect(png16.length).toBeLessThan(png32.length);
    expect(png32.length).toBeLessThan(png48.length);
  });

  it('size 16 の PNG を生成できる', () => {
    const png = generateSolidPng(16, 59, 130, 246, 255);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(100);
  });

  it('size 128 の PNG を生成できる', () => {
    const png = generateSolidPng(128, 59, 130, 246, 255);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(1000);
  });

  it('IHDR チャンク識別子が含まれる', () => {
    const png = generateSolidPng(8, 0, 0, 0, 255);
    // "IHDR" = [73, 72, 68, 82]
    const ihdrBytes = [73, 72, 68, 82];
    let found = false;
    for (let i = 0; i <= png.length - 4; i++) {
      if (
        png[i] === ihdrBytes[0] &&
        png[i + 1] === ihdrBytes[1] &&
        png[i + 2] === ihdrBytes[2] &&
        png[i + 3] === ihdrBytes[3]
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('IEND チャンク識別子が含まれる', () => {
    const png = generateSolidPng(4, 255, 255, 255, 255);
    // "IEND" = [73, 69, 78, 68]
    const iendBytes = [73, 69, 78, 68];
    let found = false;
    for (let i = 0; i <= png.length - 4; i++) {
      if (
        png[i] === iendBytes[0] &&
        png[i + 1] === iendBytes[1] &&
        png[i + 2] === iendBytes[2] &&
        png[i + 3] === iendBytes[3]
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('アルファ 0 (透明) でも PNG を生成できる', () => {
    const png = generateSolidPng(8, 0, 0, 0, 0);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(50);
  });
});

// Phase 8: generateCirclePng (円形背景 + P 文字) のテスト
describe('generateCirclePng', () => {
  it('PNG シグネチャで始まる', () => {
    const png = generateCirclePng(16);
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
      expect(png[i]).toBe(PNG_SIGNATURE[i]);
    }
  });

  it('Uint8Array を返す', () => {
    const png = generateCirclePng(32);
    expect(png).toBeInstanceOf(Uint8Array);
  });

  it('size 16 の PNG を生成できる', () => {
    const png = generateCirclePng(16);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(50);
  });

  it('size 32 の PNG を生成できる', () => {
    const png = generateCirclePng(32);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(100);
  });

  it('size 48 の PNG を生成できる', () => {
    const png = generateCirclePng(48);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(200);
  });

  it('size 128 の PNG を生成できる', () => {
    const png = generateCirclePng(128);
    expect(png).toBeInstanceOf(Uint8Array);
    expect(png.length).toBeGreaterThan(1000);
  });

  it('サイズが大きくなるにつれてバイト数が増加する', () => {
    const png16 = generateCirclePng(16);
    const png32 = generateCirclePng(32);
    const png128 = generateCirclePng(128);
    expect(png16.length).toBeLessThan(png32.length);
    expect(png32.length).toBeLessThan(png128.length);
  });

  it('IHDR チャンクを含む', () => {
    const png = generateCirclePng(16);
    const ihdrBytes = [73, 72, 68, 82]; // "IHDR"
    let found = false;
    for (let i = 0; i <= png.length - 4; i++) {
      if (
        png[i] === ihdrBytes[0] &&
        png[i + 1] === ihdrBytes[1] &&
        png[i + 2] === ihdrBytes[2] &&
        png[i + 3] === ihdrBytes[3]
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('IEND チャンクを含む', () => {
    const png = generateCirclePng(16);
    const iendBytes = [73, 69, 78, 68]; // "IEND"
    let found = false;
    for (let i = 0; i <= png.length - 4; i++) {
      if (
        png[i] === iendBytes[0] &&
        png[i + 1] === iendBytes[1] &&
        png[i + 2] === iendBytes[2] &&
        png[i + 3] === iendBytes[3]
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe('shouldWriteIcon', () => {
  it('ファイルが存在しないなら force に関係なく true', () => {
    expect(shouldWriteIcon(false, false)).toBe(true);
    expect(shouldWriteIcon(false, true)).toBe(true);
  });

  it('ファイルが存在するなら force=false で false (上書きしない)', () => {
    expect(shouldWriteIcon(true, false)).toBe(false);
  });

  it('ファイルが存在するなら force=true で true (上書きする)', () => {
    expect(shouldWriteIcon(true, true)).toBe(true);
  });
});

describe('parseForceFlag', () => {
  it('--force があれば true', () => {
    expect(parseForceFlag(['--force'])).toBe(true);
    expect(parseForceFlag(['foo', '--force', 'bar'])).toBe(true);
  });

  it('-f があれば true', () => {
    expect(parseForceFlag(['-f'])).toBe(true);
  });

  it('どちらも無ければ false', () => {
    expect(parseForceFlag([])).toBe(false);
    expect(parseForceFlag(['--other'])).toBe(false);
  });

  it('--force-something のような部分一致は拾わない', () => {
    expect(parseForceFlag(['--force-other'])).toBe(false);
  });
});
