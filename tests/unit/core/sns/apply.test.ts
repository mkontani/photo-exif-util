import { applySnsProfile, isSnsApplyError } from '@/core/sns/apply';
import type { SnsApplyDeps } from '@/core/sns/apply';
import { getProfileById } from '@/core/sns/profiles';
import type { SnsProfile } from '@/core/sns/types';
/**
 * applySnsProfile パイプラインの DI モックテスト。
 * ブラウザ依存 (decode/resize/encode) をモックで注入し、
 * パイプラインの制御フローと引数渡しを検証する。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 擬似 ImageBitmap (テスト環境には存在しない)
const makeMockBitmap = (width = 4000, height = 3000) =>
  ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;

// 擬似 OffscreenCanvas
const makeMockCanvas = () => ({}) as unknown as OffscreenCanvas;

// デフォルト deps ファクトリ
function makeDeps(overrides: Partial<SnsApplyDeps> = {}): SnsApplyDeps {
  return {
    decode: vi.fn().mockResolvedValue(makeMockBitmap()),
    resize: vi.fn().mockResolvedValue(makeMockCanvas()),
    encode: vi.fn().mockResolvedValue(new Blob([new Uint8Array(100_000)], { type: 'image/jpeg' })),
    strip: vi.fn().mockResolvedValue({
      blob: new Blob([new Uint8Array(100_000)], { type: 'image/jpeg' }),
      removedKeys: ['Make', 'GPSLatitude'],
    }),
    ...overrides,
  };
}

// テスト用シンプルプロファイル (maxFileSizeKB なし)
const profileFixed: SnsProfile = {
  id: 'test-fixed',
  label: 'Test Fixed Quality',
  maxWidth: 1080,
  maxHeight: 1080,
  preferredFormat: 'jpeg',
  defaultQuality: 85,
  stripExif: true,
  defaultStripCategories: 'all',
};

// maxFileSizeKB あり (quality search が動く)
const profileWithSizeTarget: SnsProfile = {
  id: 'test-size-target',
  label: 'Test Size Target',
  maxWidth: 1080,
  maxHeight: 1080,
  maxFileSizeKB: 100, // 100KB ターゲット
  preferredFormat: 'jpeg',
  defaultQuality: 85,
  stripExif: true,
  defaultStripCategories: 'all',
};

// stripExif: false
const profileNoStrip: SnsProfile = {
  id: 'test-no-strip',
  label: 'Test No Strip',
  maxWidth: 1080,
  maxHeight: 1080,
  preferredFormat: 'jpeg',
  defaultQuality: 85,
  stripExif: false,
};

// cover モード
const profileCover: SnsProfile = {
  id: 'test-cover',
  label: 'Test Cover',
  maxWidth: 1080,
  maxHeight: 1080,
  aspectRatio: { w: 1, h: 1, mode: 'cover' },
  preferredFormat: 'jpeg',
  defaultQuality: 85,
  stripExif: true,
  defaultStripCategories: 'all',
};

describe('applySnsProfile', () => {
  let inputBlob: Blob;

  beforeEach(() => {
    inputBlob = new Blob([new Uint8Array(200_000)], { type: 'image/jpeg' });
  });

  describe('正常パイプライン (maxFileSizeKB なし)', () => {
    it('decode → resize → encode の順で呼ばれる', async () => {
      const deps = makeDeps();
      await applySnsProfile(inputBlob, profileFixed, deps);

      expect(deps.decode).toHaveBeenCalledOnce();
      expect(deps.decode).toHaveBeenCalledWith(inputBlob);
      expect(deps.resize).toHaveBeenCalledOnce();
      expect(deps.encode).toHaveBeenCalledOnce();
    });

    it('encode は defaultQuality で 1 回だけ呼ばれる', async () => {
      const deps = makeDeps();
      await applySnsProfile(inputBlob, profileFixed, deps);

      expect(deps.encode).toHaveBeenCalledOnce();
      const [, , quality] = (deps.encode as ReturnType<typeof vi.fn>).mock.calls[0] as [
        unknown,
        unknown,
        number,
      ];
      expect(quality).toBe(85);
    });

    it('stripExif=true のとき strip が呼ばれる', async () => {
      const deps = makeDeps();
      await applySnsProfile(inputBlob, profileFixed, deps);

      expect(deps.strip).toHaveBeenCalledOnce();
    });

    it('結果の profileId が正しい', async () => {
      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profileFixed, deps);
      expect(result.profileId).toBe('test-fixed');
    });

    it('結果の outputFormat が profile と一致', async () => {
      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profileFixed, deps);
      expect(result.outputFormat).toBe('jpeg');
    });

    it('結果の removedExifKeys が strip の結果と一致', async () => {
      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profileFixed, deps);
      expect(result.removedExifKeys).toEqual(['Make', 'GPSLatitude']);
    });

    it('outputSizeBytes が encode 結果の Blob サイズと一致', async () => {
      const stripBlob = new Blob([new Uint8Array(80_000)], { type: 'image/jpeg' });
      const deps = makeDeps({
        strip: vi.fn().mockResolvedValue({ blob: stripBlob, removedKeys: [] }),
      });
      const result = await applySnsProfile(inputBlob, profileFixed, deps);
      expect(result.outputSizeBytes).toBe(80_000);
    });
  });

  describe('maxFileSizeKB あり (quality search)', () => {
    it('encode が複数回呼ばれる (binary search)', async () => {
      // 100KB target。encode は常に 200KB → binary search が lo を下げていく
      const deps = makeDeps({
        encode: vi
          .fn()
          .mockResolvedValue(new Blob([new Uint8Array(200_000)], { type: 'image/jpeg' })),
      });

      await applySnsProfile(inputBlob, profileWithSizeTarget, deps);

      expect((deps.encode as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    });

    it('encode に渡す品質は 0-100 の範囲内', async () => {
      const deps = makeDeps();
      await applySnsProfile(inputBlob, profileWithSizeTarget, deps);

      const calls = (deps.encode as ReturnType<typeof vi.fn>).mock.calls as [
        unknown,
        unknown,
        number,
      ][];
      for (const [, , quality] of calls) {
        expect(quality).toBeGreaterThanOrEqual(0);
        expect(quality).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('stripExif: false', () => {
    it('strip が呼ばれない', async () => {
      const deps = makeDeps();
      await applySnsProfile(inputBlob, profileNoStrip, deps);

      expect(deps.strip).not.toHaveBeenCalled();
    });

    it('removedExifKeys が空配列', async () => {
      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profileNoStrip, deps);
      expect(result.removedExifKeys).toEqual([]);
    });
  });

  describe('cover モード', () => {
    it('resize に cropOffset が渡される', async () => {
      const deps = makeDeps({
        decode: vi.fn().mockResolvedValue(makeMockBitmap(4000, 3000)),
      });
      await applySnsProfile(inputBlob, profileCover, deps);

      expect(deps.resize).toHaveBeenCalledOnce();
      const [, target] = (deps.resize as ReturnType<typeof vi.fn>).mock.calls[0] as [
        unknown,
        { width: number; height: number; cropOffset?: { x: number; y: number } },
      ];
      // 4000x3000 を 1:1 cover なので cropOffset が存在するはず
      expect(target.cropOffset).toBeDefined();
    });
  });

  describe('エラーパス', () => {
    it('decode が失敗 → DECODE_FAILED で reject', async () => {
      const deps = makeDeps({
        decode: vi.fn().mockRejectedValue(new Error('decode error')),
      });

      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'DECODE_FAILED',
      });
    });

    it('resize が失敗 → RESIZE_FAILED で reject', async () => {
      const deps = makeDeps({
        resize: vi.fn().mockRejectedValue(new Error('resize error')),
      });

      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'RESIZE_FAILED',
      });
    });

    it('encode が失敗 → ENCODE_FAILED で reject', async () => {
      const deps = makeDeps({
        encode: vi.fn().mockRejectedValue(new Error('encode error')),
      });

      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'ENCODE_FAILED',
      });
    });

    it('invalid profile (maxWidth < 0) → INVALID_PROFILE で reject', async () => {
      const badProfile: SnsProfile = {
        ...profileFixed,
        maxWidth: -1,
      };
      const deps = makeDeps();

      await expect(applySnsProfile(inputBlob, badProfile, deps)).rejects.toMatchObject({
        code: 'INVALID_PROFILE',
      });
    });
  });

  describe('実プロファイルとの統合', () => {
    it('getProfileById("ig-square") で取得したプロファイルで正常動作', async () => {
      const profile = getProfileById('ig-square');
      expect(profile).toBeDefined();
      if (!profile) return;

      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profile, deps);

      expect(result.profileId).toBe('ig-square');
      expect(result.outputFormat).toBe('jpeg');
    });

    it('line-talk (maxFileSizeKB=1024) で size search が動く', async () => {
      const profile = getProfileById('line-talk');
      expect(profile).toBeDefined();
      if (!profile) return;

      const deps = makeDeps({
        encode: vi
          .fn()
          .mockResolvedValue(new Blob([new Uint8Array(2_000_000)], { type: 'image/jpeg' })),
      });
      await applySnsProfile(inputBlob, profile, deps);

      // 2MB > 1024KB なので binary search が複数回 encode を呼ぶ
      expect((deps.encode as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    });

    it('decode が SnsApplyError を reject → そのまま再 reject される', async () => {
      // isSnsApplyError ブランチ: decode が DECODE_FAILED を直接 reject するケース
      const decodeErr = { code: 'DECODE_FAILED', message: 'already typed error' };
      const deps = makeDeps({
        decode: vi.fn().mockRejectedValue(decodeErr),
      });

      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'DECODE_FAILED',
        message: 'already typed error',
      });
    });

    it('resize が SnsApplyError を reject → そのまま再 reject される', async () => {
      const resizeErr = { code: 'RESIZE_FAILED', message: 'already typed resize error' };
      const deps = makeDeps({
        resize: vi.fn().mockRejectedValue(resizeErr),
      });

      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'RESIZE_FAILED',
        message: 'already typed resize error',
      });
    });

    it('encode が SnsApplyError を reject (maxFileSizeKB あり) → ENCODE_FAILED で reject', async () => {
      const encodeErr = { code: 'ENCODE_FAILED', message: 'already typed encode error' };
      const deps = makeDeps({
        encode: vi.fn().mockRejectedValue(encodeErr),
      });

      await expect(applySnsProfile(inputBlob, profileWithSizeTarget, deps)).rejects.toMatchObject({
        code: 'ENCODE_FAILED',
      });
    });

    it('encode が型付き SnsApplyError を reject (maxFileSizeKB あり、isSnsApplyError ブランチ)', async () => {
      // searchQuality の encode コールバック内で SnsApplyError が throw される場合
      // isSnsApplyError(cause) === true → そのまま再 reject
      const encodeErr = { code: 'ENCODE_FAILED', message: 'typed error in search' };
      let callCount = 0;
      const deps = makeDeps({
        encode: vi.fn().mockImplementation(async () => {
          callCount++;
          // searchQuality の内部コールバックと最終 encode の両方が通るよう
          // 2 回目以降で typed error を reject
          if (callCount >= 2) return Promise.reject(encodeErr);
          return new Blob([new Uint8Array(2_000_000)], { type: 'image/jpeg' });
        }),
      });

      await expect(applySnsProfile(inputBlob, profileWithSizeTarget, deps)).rejects.toMatchObject({
        code: 'ENCODE_FAILED',
      });
    });

    it('defaultStripCategories が配列の場合は remove に渡される', async () => {
      // 行 147: defaultStripCategories が 'all' でも undefined でもない場合
      const profileWithCategories: SnsProfile = {
        ...profileFixed,
        defaultStripCategories: ['gps', 'device'] as const,
      };
      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profileWithCategories, deps);

      expect(result.profileId).toBe('test-fixed');
      // strip が呼ばれ、options.remove に配列が渡されることを確認
      const stripCall = (deps.strip as ReturnType<typeof vi.fn>).mock.calls[0] as [
        Blob,
        { remove: unknown },
      ];
      expect(stripCall[1]?.remove).toEqual(['gps', 'device']);
    });
  });

  describe('isSnsApplyError 型ガード', () => {
    it('DECODE_FAILED オブジェクトは true', () => {
      expect(isSnsApplyError({ code: 'DECODE_FAILED', message: 'test' })).toBe(true);
    });

    it('RESIZE_FAILED オブジェクトは true', () => {
      expect(isSnsApplyError({ code: 'RESIZE_FAILED', message: 'test' })).toBe(true);
    });

    it('ENCODE_FAILED オブジェクトは true', () => {
      expect(isSnsApplyError({ code: 'ENCODE_FAILED', message: 'test' })).toBe(true);
    });

    it('SIZE_TARGET_UNREACHABLE は true', () => {
      expect(
        isSnsApplyError({ code: 'SIZE_TARGET_UNREACHABLE', message: 'test', bestSize: 0 }),
      ).toBe(true);
    });

    it('INVALID_PROFILE は true', () => {
      expect(isSnsApplyError({ code: 'INVALID_PROFILE', message: 'test' })).toBe(true);
    });

    it('null は false', () => {
      expect(isSnsApplyError(null)).toBe(false);
    });

    it('undefined は false', () => {
      expect(isSnsApplyError(undefined)).toBe(false);
    });

    it('code なしオブジェクトは false', () => {
      expect(isSnsApplyError({ message: 'test' })).toBe(false);
    });

    it('code が数値は false', () => {
      expect(isSnsApplyError({ code: 42 })).toBe(false);
    });

    it('未知の code は false', () => {
      expect(isSnsApplyError({ code: 'UNKNOWN_ERROR', message: 'test' })).toBe(false);
    });

    it('string は false', () => {
      expect(isSnsApplyError('error string')).toBe(false);
    });
  });

  describe('sizeTargetReached フィールド', () => {
    it('maxFileSizeKB なしのプロファイルでは常に true', async () => {
      const deps = makeDeps();
      const result = await applySnsProfile(inputBlob, profileFixed, deps);
      expect(result.sizeTargetReached).toBe(true);
    });

    it('maxFileSizeKB ありで quality search が収束 → true', async () => {
      // target 100KB の tolerance 0.1 → 90KB～110KB の範囲。95KB を返して収束させる
      const deps = makeDeps({
        encode: vi
          .fn()
          .mockResolvedValue(new Blob([new Uint8Array(95_000)], { type: 'image/jpeg' })),
      });
      const result = await applySnsProfile(inputBlob, profileWithSizeTarget, deps);
      expect(result.sizeTargetReached).toBe(true);
    });

    it('maxFileSizeKB ありで quality search が収束しない → false', async () => {
      // 全反復で target を大幅に超過 (10MB 固定) → minQuality でも fail
      const deps = makeDeps({
        encode: vi
          .fn()
          .mockResolvedValue(new Blob([new Uint8Array(10_000_000)], { type: 'image/jpeg' })),
      });
      const result = await applySnsProfile(inputBlob, profileWithSizeTarget, deps);
      expect(result.sizeTargetReached).toBe(false);
    });
  });

  describe('ImageBitmap.close() のリソース解放', () => {
    it('正常パイプラインで bitmap.close() が呼ばれる', async () => {
      const closeSpy = vi.fn();
      const fakeBitmap = {
        width: 4000,
        height: 3000,
        close: closeSpy,
      } as unknown as ImageBitmap;
      const deps = makeDeps({ decode: vi.fn().mockResolvedValue(fakeBitmap) });
      await applySnsProfile(inputBlob, profileFixed, deps);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('resize 失敗でも bitmap.close() が呼ばれる (finally)', async () => {
      const closeSpy = vi.fn();
      const fakeBitmap = {
        width: 4000,
        height: 3000,
        close: closeSpy,
      } as unknown as ImageBitmap;
      const deps = makeDeps({
        decode: vi.fn().mockResolvedValue(fakeBitmap),
        resize: vi.fn().mockRejectedValue(new Error('resize failure')),
      });
      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'RESIZE_FAILED',
      });
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('encode 失敗でも bitmap.close() が呼ばれる (finally)', async () => {
      const closeSpy = vi.fn();
      const fakeBitmap = {
        width: 4000,
        height: 3000,
        close: closeSpy,
      } as unknown as ImageBitmap;
      const deps = makeDeps({
        decode: vi.fn().mockResolvedValue(fakeBitmap),
        encode: vi.fn().mockRejectedValue(new Error('encode failure')),
      });
      await expect(applySnsProfile(inputBlob, profileFixed, deps)).rejects.toMatchObject({
        code: 'ENCODE_FAILED',
      });
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchQuality 後の最終 encode 失敗', () => {
    it('searchQuality 内 encode が直接 throw → ENCODE_FAILED', async () => {
      // searchQuality の最初のコールバックで throw → catch で ENCODE_FAILED
      const deps = makeDeps({
        encode: vi.fn().mockRejectedValue(new Error('encode failure inside search')),
      });
      await expect(applySnsProfile(inputBlob, profileWithSizeTarget, deps)).rejects.toMatchObject({
        code: 'ENCODE_FAILED',
      });
    });
  });
});
