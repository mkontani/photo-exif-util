import { searchQuality } from '@/core/image/quality-search';
/**
 * 品質バイナリサーチアルゴリズムのテスト。
 * encode 関数をモックで注入して純粋にアルゴリズムを検証する。
 */
import { describe, expect, it } from 'vitest';

/**
 * quality に応じてサイズが単調減少するシンプルなモック encode。
 * quality=100 → maxBytes、quality=0 → minBytes で線形補間する。
 */
function makeLinearEncode(maxBytes: number, minBytes: number) {
  return async (quality: number): Promise<{ sizeBytes: number }> => {
    const sizeBytes = Math.round(minBytes + (quality / 100) * (maxBytes - minBytes));
    return { sizeBytes };
  };
}

describe('searchQuality', () => {
  describe('収束ケース', () => {
    it('target 500KB、±10% tolerance で収束する', async () => {
      const targetSizeBytes = 500 * 1024; // 512000
      const encode = makeLinearEncode(2_000_000, 50_000);

      const result = await searchQuality(encode, {
        targetSizeBytes,
        tolerance: 0.1,
        minQuality: 10,
        maxQuality: 95,
      });

      expect(result.converged).toBe(true);
      expect(result.sizeBytes).toBeGreaterThanOrEqual(targetSizeBytes * 0.9);
      expect(result.sizeBytes).toBeLessThanOrEqual(targetSizeBytes * 1.1);
    });

    it('target が極大 (100MB) で lo=maxQuality でも下回る → maxQuality を返し converged=true', async () => {
      // quality=100 でも size < target になるケース
      // maxBytes = 1MB < 100MB target → 常に target 以下
      const targetSizeBytes = 100 * 1024 * 1024; // 100MB
      const encode = makeLinearEncode(1_000_000, 10_000);

      const result = await searchQuality(encode, {
        targetSizeBytes,
        tolerance: 0.1,
        minQuality: 10,
        maxQuality: 95,
      });

      // サイズが target * (1 - tolerance) を下回っているので converged と判定
      // (target 内に収まっているため)
      expect(result.quality).toBe(95);
      expect(result.converged).toBe(true);
    });

    it('品質は minQuality と maxQuality の範囲内', async () => {
      const encode = makeLinearEncode(2_000_000, 50_000);

      const result = await searchQuality(encode, {
        targetSizeBytes: 300 * 1024,
        tolerance: 0.1,
        minQuality: 20,
        maxQuality: 90,
      });

      expect(result.quality).toBeGreaterThanOrEqual(20);
      expect(result.quality).toBeLessThanOrEqual(90);
    });
  });

  describe('非収束ケース (maxIterations 超過)', () => {
    it('maxIterations を超えると converged=false かつ best 結果を返す', async () => {
      // 非常に厳しい tolerance で収束しないケースを再現するため
      // encode が常に同じサイズを返す (バイナリサーチが振れない) 状況
      let callCount = 0;
      const encode = async (_quality: number): Promise<{ sizeBytes: number }> => {
        callCount++;
        // mid が変化しても常に target の 50% のサイズを返す
        return { sizeBytes: 250_000 };
      };

      const result = await searchQuality(encode, {
        targetSizeBytes: 500_000,
        tolerance: 0.001, // 0.1% — 250_000 は 500_000 の 50% で収束しない
        minQuality: 10,
        maxQuality: 95,
        maxIterations: 5,
      });

      expect(result.converged).toBe(false);
      expect(result.iterations).toBeLessThanOrEqual(5);
      expect(callCount).toBeLessThanOrEqual(5);
    });

    it('反復回数は maxIterations を超えない', async () => {
      let callCount = 0;
      const encode = async (_quality: number): Promise<{ sizeBytes: number }> => {
        callCount++;
        // quality に関わらず常に target の 2 倍を返す → lo=mid+1 で hi に達する
        return { sizeBytes: 1_000_000 };
      };

      await searchQuality(encode, {
        targetSizeBytes: 500_000,
        tolerance: 0.01,
        minQuality: 10,
        maxQuality: 95,
        maxIterations: 8,
      });

      expect(callCount).toBeLessThanOrEqual(8);
    });
  });

  describe('フォールバックケース', () => {
    it('target が極小 (1KB) で minQuality でも超過 → minQuality を返し converged=false', async () => {
      // quality=10 でも size > target になるケース
      const targetSizeBytes = 1024; // 1KB
      const encode = makeLinearEncode(2_000_000, 100_000); // min でも 100KB > 1KB

      const result = await searchQuality(encode, {
        targetSizeBytes,
        tolerance: 0.1,
        minQuality: 10,
        maxQuality: 95,
      });

      expect(result.quality).toBe(10);
      expect(result.converged).toBe(false);
    });
  });

  describe('iterations カウント', () => {
    it('iterations が返される (>= 1)', async () => {
      const encode = makeLinearEncode(2_000_000, 50_000);

      const result = await searchQuality(encode, {
        targetSizeBytes: 500 * 1024,
        tolerance: 0.1,
        minQuality: 10,
        maxQuality: 95,
      });

      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });

    it('デフォルト maxIterations=8 が適用される (明示しなくても収束する)', async () => {
      const encode = makeLinearEncode(2_000_000, 50_000);

      const result = await searchQuality(encode, {
        targetSizeBytes: 500 * 1024,
        tolerance: 0.1,
        minQuality: 10,
        maxQuality: 95,
        // maxIterations 未指定 → デフォルト 8
      });

      expect(result.iterations).toBeLessThanOrEqual(8);
    });
  });

  describe('品質の境界値', () => {
    it('minQuality=0, maxQuality=100 でも正常動作', async () => {
      const encode = makeLinearEncode(2_000_000, 0);

      const result = await searchQuality(encode, {
        targetSizeBytes: 1_000_000,
        tolerance: 0.1,
        minQuality: 0,
        maxQuality: 100,
      });

      expect(result.quality).toBeGreaterThanOrEqual(0);
      expect(result.quality).toBeLessThanOrEqual(100);
    });

    it('minQuality = maxQuality の場合はその品質で 1 回だけ encode', async () => {
      let callCount = 0;
      const encode = async (_quality: number): Promise<{ sizeBytes: number }> => {
        callCount++;
        return { sizeBytes: 500_000 };
      };

      const result = await searchQuality(encode, {
        targetSizeBytes: 500_000,
        tolerance: 0.1,
        minQuality: 50,
        maxQuality: 50,
      });

      expect(result.quality).toBe(50);
      expect(callCount).toBe(1);
    });
  });
});
