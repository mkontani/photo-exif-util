import { formatBytes, formatDimensions } from '@/utils/format-size';
import { describe, expect, it } from 'vitest';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [50 * 1024 * 1024, '50.0 MB'],
    [1024 * 1024 * 1024, '1.00 GB'],
  ])('%i bytes → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('負値は "—"', () => {
    expect(formatBytes(-1)).toBe('—');
  });

  it('NaN は "—"', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
  });

  it('Infinity は "—"', () => {
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatDimensions', () => {
  it('整数寸法 → "WxH" 形式', () => {
    expect(formatDimensions({ width: 1920, height: 1080 })).toBe('1920×1080');
  });

  it('浮動小数点は丸める', () => {
    expect(formatDimensions({ width: 1920.7, height: 1080.3 })).toBe('1921×1080');
  });

  it('undefined は "—"', () => {
    expect(formatDimensions(undefined)).toBe('—');
  });

  it('NaN を含むと "—"', () => {
    expect(formatDimensions({ width: Number.NaN, height: 100 })).toBe('—');
  });
});
