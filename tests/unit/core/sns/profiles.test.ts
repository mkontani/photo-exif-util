import { SNS_PROFILES, getProfileById } from '@/core/sns/profiles';
import type { OutputFormat, SnsProfile } from '@/core/sns/types';
/**
 * SNS プロファイル定数の完全性検証。
 * プロファイルが仕様通りに定義されているかを純粋に確認する。
 */
import { describe, expect, it } from 'vitest';

describe('SNS_PROFILES', () => {
  it('11 種類以上のプロファイルが定義されている', () => {
    expect(SNS_PROFILES.length).toBeGreaterThanOrEqual(11);
  });

  it('すべての id がユニーク', () => {
    const ids = SNS_PROFILES.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('すべて stripExif: true', () => {
    for (const profile of SNS_PROFILES) {
      expect(profile.stripExif, `profile ${profile.id} should have stripExif: true`).toBe(true);
    }
  });

  it('すべて defaultStripCategories: all', () => {
    for (const profile of SNS_PROFILES) {
      expect(
        profile.defaultStripCategories,
        `profile ${profile.id} should have defaultStripCategories: 'all'`,
      ).toBe('all');
    }
  });

  it('custom 以外の maxWidth/maxHeight が正の整数', () => {
    for (const profile of SNS_PROFILES) {
      if (profile.id === 'custom') continue;
      expect(profile.maxWidth, `${profile.id}.maxWidth`).toBeGreaterThan(0);
      expect(profile.maxHeight, `${profile.id}.maxHeight`).toBeGreaterThan(0);
      expect(Number.isInteger(profile.maxWidth), `${profile.id}.maxWidth is integer`).toBe(true);
      expect(Number.isInteger(profile.maxHeight), `${profile.id}.maxHeight is integer`).toBe(true);
    }
  });

  it('preferredFormat が jpeg または webp のみ', () => {
    const validFormats: OutputFormat[] = ['jpeg', 'webp'];
    for (const profile of SNS_PROFILES) {
      expect(validFormats, `${profile.id}.preferredFormat`).toContain(profile.preferredFormat);
    }
  });

  it('defaultQuality が 0-100 の範囲', () => {
    for (const profile of SNS_PROFILES) {
      expect(profile.defaultQuality, `${profile.id}.defaultQuality`).toBeGreaterThanOrEqual(0);
      expect(profile.defaultQuality, `${profile.id}.defaultQuality`).toBeLessThanOrEqual(100);
    }
  });

  it('label が空でない文字列', () => {
    for (const profile of SNS_PROFILES) {
      expect(typeof profile.label).toBe('string');
      expect(profile.label.length, `${profile.id}.label`).toBeGreaterThan(0);
    }
  });

  describe('期待されるプロファイル ID が存在する', () => {
    const expectedIds = [
      'x-post',
      'x-card',
      'ig-square',
      'ig-portrait',
      'ig-story',
      'threads-post',
      'line-talk',
      'line-timeline',
      'bluesky-post',
      'fb-post',
      'custom',
    ];

    for (const id of expectedIds) {
      it(`id: "${id}" が存在する`, () => {
        const found = SNS_PROFILES.find((p) => p.id === id);
        expect(found).toBeDefined();
      });
    }
  });

  describe('個別プロファイルの仕様検証', () => {
    it('x-post: maxWidth=4096, maxHeight=4096, maxFileSizeKB=5120, format=jpeg, quality=85', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'x-post');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxWidth).toBe(4096);
      expect(p.maxHeight).toBe(4096);
      expect(p.maxFileSizeKB).toBe(5120);
      expect(p.preferredFormat).toBe('jpeg');
      expect(p.defaultQuality).toBe(85);
    });

    it('x-card: aspectRatio 1200:628 cover', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'x-card');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxWidth).toBe(1200);
      expect(p.maxHeight).toBe(628);
      expect(p.aspectRatio).toBeDefined();
      expect(p.aspectRatio?.w).toBe(1200);
      expect(p.aspectRatio?.h).toBe(628);
      expect(p.aspectRatio?.mode).toBe('cover');
    });

    it('ig-square: 1080x1080, 1:1 cover, maxFileSizeKB 未設定', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'ig-square');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxWidth).toBe(1080);
      expect(p.maxHeight).toBe(1080);
      expect(p.aspectRatio?.w).toBe(1);
      expect(p.aspectRatio?.h).toBe(1);
      expect(p.aspectRatio?.mode).toBe('cover');
      expect(p.maxFileSizeKB).toBeUndefined();
    });

    it('ig-portrait: 1080x1350, 4:5 cover', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'ig-portrait');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxWidth).toBe(1080);
      expect(p.maxHeight).toBe(1350);
      expect(p.aspectRatio?.w).toBe(4);
      expect(p.aspectRatio?.h).toBe(5);
      expect(p.aspectRatio?.mode).toBe('cover');
    });

    it('ig-story: 1080x1920, 9:16 cover', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'ig-story');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxWidth).toBe(1080);
      expect(p.maxHeight).toBe(1920);
      expect(p.aspectRatio?.w).toBe(9);
      expect(p.aspectRatio?.h).toBe(16);
      expect(p.aspectRatio?.mode).toBe('cover');
    });

    it('line-talk: maxFileSizeKB=1024', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'line-talk');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxFileSizeKB).toBe(1024);
    });

    it('bluesky-post: maxFileSizeKB=976 (Bluesky AT Protocol 1,000,000 bytes 上限)', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'bluesky-post');
      expect(p).toBeDefined();
      if (!p?.maxFileSizeKB) return;
      expect(p.maxFileSizeKB).toBe(976);
      // 安全側: KiB 換算で 1MB (1,000,000 bytes) を超えないこと
      expect(p.maxFileSizeKB * 1024).toBeLessThan(1_000_000);
    });

    it('custom: maxWidth=0, maxHeight=0', () => {
      const p = SNS_PROFILES.find((p) => p.id === 'custom');
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.maxWidth).toBe(0);
      expect(p.maxHeight).toBe(0);
    });
  });
});

describe('getProfileById', () => {
  it('既知の id から正しいプロファイルを返す', () => {
    const p = getProfileById('ig-square');
    expect(p).toBeDefined();
    expect(p?.id).toBe('ig-square');
  });

  it('未知の id では undefined を返す', () => {
    const p = getProfileById('unknown-profile');
    expect(p).toBeUndefined();
  });

  it('空文字では undefined を返す', () => {
    const p = getProfileById('');
    expect(p).toBeUndefined();
  });

  it('返されたプロファイルは SnsProfile の必須フィールドを持つ', () => {
    const p = getProfileById('x-post');
    expect(p).toBeDefined();
    if (!p) return;
    const keys: (keyof SnsProfile)[] = [
      'id',
      'label',
      'maxWidth',
      'maxHeight',
      'preferredFormat',
      'defaultQuality',
      'stripExif',
    ];
    for (const key of keys) {
      expect(key in p, `SnsProfile.${key} が存在する`).toBe(true);
    }
  });
});
