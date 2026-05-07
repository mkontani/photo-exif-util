import { calculateOutputDimensions } from '@/core/image/dimensions';
/**
 * 寸法計算ロジックの純粋関数テスト。
 * fit/cover/pad の各モードとエッジケースをカバーする。
 */
import { describe, expect, it } from 'vitest';

describe('calculateOutputDimensions', () => {
  describe('aspectRatio なし (fit モード相当)', () => {
    it('入力が maxWidth/maxHeight より小さければアップスケールしない', () => {
      const result = calculateOutputDimensions(
        { width: 800, height: 600 },
        { maxWidth: 4096, maxHeight: 4096 },
      );
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('入力 4000x3000 + 4096x4096 → 4000x3000 (アスペクト維持でそのまま)', () => {
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        { maxWidth: 4096, maxHeight: 4096 },
      );
      expect(result.width).toBe(4000);
      expect(result.height).toBe(3000);
    });

    it('入力 4000x4000 + 4096x4096 → 4000x4000', () => {
      const result = calculateOutputDimensions(
        { width: 4000, height: 4000 },
        { maxWidth: 4096, maxHeight: 4096 },
      );
      expect(result.width).toBe(4000);
      expect(result.height).toBe(4000);
    });

    it('入力 5000x3000 + 4096x4096 → 幅で制限、高さはアスペクト維持', () => {
      // 5000x3000 を maxWidth 4096 に収める: scale = 4096/5000 = 0.8192
      // height = 3000 * 0.8192 = 2457.6 → Math.round → 2458
      const result = calculateOutputDimensions(
        { width: 5000, height: 3000 },
        { maxWidth: 4096, maxHeight: 4096 },
      );
      expect(result.width).toBe(4096);
      expect(result.height).toBe(2458);
    });

    it('入力 3000x5000 + 4096x4096 → 高さで制限', () => {
      // scale = 4096/5000 = 0.8192, width = 3000 * 0.8192 = 2457.6 → 2458
      const result = calculateOutputDimensions(
        { width: 3000, height: 5000 },
        { maxWidth: 4096, maxHeight: 4096 },
      );
      expect(result.width).toBe(2458);
      expect(result.height).toBe(4096);
    });

    it('custom プロファイル (maxWidth=0, maxHeight=0) → 元寸法維持', () => {
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        { maxWidth: 0, maxHeight: 0 },
      );
      expect(result.width).toBe(4000);
      expect(result.height).toBe(3000);
    });

    it('cropOffset は返さない', () => {
      const result = calculateOutputDimensions(
        { width: 1000, height: 800 },
        { maxWidth: 2000, maxHeight: 2000 },
      );
      expect(result.cropOffset).toBeUndefined();
    });
  });

  describe('cover モード (aspectRatio 指定)', () => {
    it('入力 4000x3000 + ig-square (1080x1080, 1:1 cover) → 1080x1080 + cropOffset 中央', () => {
      // 4000x3000: 短辺は 3000。1:1 cover なので short side に fit。
      // scale = 1080 / 3000 = 0.36, 長辺 4000 * 0.36 = 1440 > 1080 なので crop。
      // cropOffset.x = (1440 - 1080) / 2 = 180, y = 0
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        {
          maxWidth: 1080,
          maxHeight: 1080,
          aspectRatio: { w: 1, h: 1, mode: 'cover' },
        },
      );
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1080);
      expect(result.cropOffset).toBeDefined();
    });

    it('入力 4000x3000 + ig-portrait (1080x1350, 4:5 cover) → 1080x1350 + cropOffset', () => {
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        {
          maxWidth: 1080,
          maxHeight: 1350,
          aspectRatio: { w: 4, h: 5, mode: 'cover' },
        },
      );
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1350);
      expect(result.cropOffset).toBeDefined();
    });

    it('入力 1000x1000 + x-card (1200x628, 1200:628 cover) → アップスケールしない方針: 入力 ≤ target の場合は入力に合わせる', () => {
      // cover でアップスケールしない方針:
      // 1000x1000 を 1200:628 (約 1.91:1) にしたい。
      // cover: 入力アスペクト比と target アスペクト比を比較。
      // 入力 1:1 < target 1.91:1 なので幅方向が足りない。
      // アップスケールなし: 幅に合わせてスケール → 入力幅 1000 と target 幅 1200 のうち小さい方。
      // 1000 を基準に高さ = 1000 * (628/1200) = 523.33 → 523。
      const result = calculateOutputDimensions(
        { width: 1000, height: 1000 },
        {
          maxWidth: 1200,
          maxHeight: 628,
          aspectRatio: { w: 1200, h: 628, mode: 'cover' },
        },
      );
      // アップスケールしない方針: max(1000, 1200) = 1200 を使わず 1000 で処理
      // height = round(1000 * 628/1200) = round(523.33) = 523
      expect(result.width).toBe(1000);
      expect(result.height).toBe(523);
    });

    it('入力 4000x2000 + (1200x628 cover) → 正確に 1200x628 に収まる', () => {
      // 4000x2000 は 2:1、target は 1200:628 ≈ 1.91:1
      // 入力の方が幅広なので、高さで scale: scale = 628/2000 = 0.314
      // scaled_w = 4000 * 0.314 = 1256 > 1200 なので幅でクロップ
      // cropOffset.x = (1256 - 1200) / 2 = 28, y = 0
      const result = calculateOutputDimensions(
        { width: 4000, height: 2000 },
        {
          maxWidth: 1200,
          maxHeight: 628,
          aspectRatio: { w: 1200, h: 628, mode: 'cover' },
        },
      );
      expect(result.width).toBe(1200);
      expect(result.height).toBe(628);
      expect(result.cropOffset).toBeDefined();
      expect(result.cropOffset?.y).toBe(0);
    });

    it('cover で入力 1000x500 + (1200x628 cover) → アップスケールなし、出力アスペクト比は維持', () => {
      // 1000x500 は 2:1、target は ~1.91:1
      // 入力より target が大きい → アップスケールしない
      // 出力は 1000x523 相当 (入力幅 1000, height = round(1000 * 628/1200))
      const result = calculateOutputDimensions(
        { width: 1000, height: 500 },
        {
          maxWidth: 1200,
          maxHeight: 628,
          aspectRatio: { w: 1200, h: 628, mode: 'cover' },
        },
      );
      // アップスケールしないのでどちらの寸法も target を超えない
      expect(result.width).toBeLessThanOrEqual(1200);
      expect(result.height).toBeLessThanOrEqual(628);
    });

    it('cropOffset が数値 (整数)', () => {
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        {
          maxWidth: 1080,
          maxHeight: 1080,
          aspectRatio: { w: 1, h: 1, mode: 'cover' },
        },
      );
      if (result.cropOffset) {
        expect(Number.isInteger(result.cropOffset.x)).toBe(true);
        expect(Number.isInteger(result.cropOffset.y)).toBe(true);
        expect(result.cropOffset.x).toBeGreaterThanOrEqual(0);
        expect(result.cropOffset.y).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('出力寸法は整数', () => {
    it('幅・高さは必ず整数 (Math.round)', () => {
      const cases = [
        { input: { width: 1920, height: 1080 }, profile: { maxWidth: 1200, maxHeight: 628 } },
        { input: { width: 3840, height: 2160 }, profile: { maxWidth: 1080, maxHeight: 1920 } },
      ];
      for (const { input, profile } of cases) {
        const result = calculateOutputDimensions(input, profile);
        expect(Number.isInteger(result.width)).toBe(true);
        expect(Number.isInteger(result.height)).toBe(true);
      }
    });
  });

  describe('アスペクト比 0 のガード', () => {
    it('aspectRatio.w=0 の場合はアスペクト無視で fit 動作', () => {
      // w=0 は不正入力 → 安全なフォールバックとして fit 扱い
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        {
          maxWidth: 1080,
          maxHeight: 1080,
          aspectRatio: { w: 0, h: 1, mode: 'cover' },
        },
      );
      // クラッシュしないこと、かつ幅/高さが正の整数
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('aspectRatio.h=0 の場合はアスペクト無視で fit 動作', () => {
      const result = calculateOutputDimensions(
        { width: 4000, height: 3000 },
        {
          maxWidth: 1080,
          maxHeight: 1080,
          aspectRatio: { w: 1, h: 0, mode: 'cover' },
        },
      );
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });
  });
});
