import { resolveTheme } from '@/state/theme-store';
import { describe, expect, it } from 'vitest';

describe('resolveTheme', () => {
  it('mode="light" + prefersDark=false → "light"', () => {
    expect(resolveTheme('light', false)).toBe('light');
  });

  it('mode="light" + prefersDark=true → "light" (system 無視)', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('mode="dark" + prefersDark=false → "dark"', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('mode="dark" + prefersDark=true → "dark"', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('mode="auto" + prefersDark=true → "dark"', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
  });

  it('mode="auto" + prefersDark=false → "light"', () => {
    expect(resolveTheme('auto', false)).toBe('light');
  });

  it('返り値は "light" または "dark" のみ', () => {
    const results = [
      resolveTheme('auto', true),
      resolveTheme('auto', false),
      resolveTheme('light', true),
      resolveTheme('dark', false),
    ];
    for (const r of results) {
      expect(['light', 'dark']).toContain(r);
    }
  });
});
