import { validateMagicBytes } from '@/core/ingest/magic-bytes';
import { buildAllFixtures } from '@tests/helpers/build-fixtures';
import { loadFixtureAsBlob } from '@tests/helpers/load-fixture';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  buildAllFixtures();
});

describe('validateMagicBytes', () => {
  describe('JPEG fixture', () => {
    it('detected が jpeg', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await validateMagicBytes(blob);
      expect(result.detected).toBe('jpeg');
    });

    it('accepted が true (デフォルト許可リスト)', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await validateMagicBytes(blob);
      expect(result.accepted).toBe(true);
    });

    it('allowedFormats に jpeg が含まれる場合 accepted=true', async () => {
      const blob = loadFixtureAsBlob('jpeg-no-exif.jpg');
      const result = await validateMagicBytes(blob, ['jpeg']);
      expect(result.accepted).toBe(true);
    });

    it('allowedFormats に jpeg が含まれない場合 accepted=false', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await validateMagicBytes(blob, ['png', 'webp']);
      expect(result.accepted).toBe(false);
    });
  });

  describe('PNG fixture', () => {
    it('detected が png', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await validateMagicBytes(blob);
      expect(result.detected).toBe('png');
    });

    it('accepted が true (デフォルト許可リスト)', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await validateMagicBytes(blob);
      expect(result.accepted).toBe(true);
    });

    it('allowedFormats に jpeg のみ指定した場合 PNG は accepted=false', async () => {
      const blob = loadFixtureAsBlob('png-with-text.png');
      const result = await validateMagicBytes(blob, ['jpeg']);
      expect(result.accepted).toBe(false);
    });
  });

  describe('WebP fixture', () => {
    it('detected が webp', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await validateMagicBytes(blob);
      expect(result.detected).toBe('webp');
    });

    it('accepted が true (デフォルト許可リスト)', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await validateMagicBytes(blob);
      expect(result.accepted).toBe(true);
    });
  });

  describe('不正なデータ', () => {
    it('4 bytes of zeros は detected が unknown', async () => {
      const blob = new Blob([new Uint8Array([0, 0, 0, 0])]);
      const result = await validateMagicBytes(blob);
      expect(result.detected).toBe('unknown');
    });

    it('4 bytes of zeros は accepted が false', async () => {
      const blob = new Blob([new Uint8Array([0, 0, 0, 0])]);
      const result = await validateMagicBytes(blob);
      expect(result.accepted).toBe(false);
    });

    it('ランダムバイト列は unknown として拒否される', async () => {
      const blob = new Blob([new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01])]);
      const result = await validateMagicBytes(blob);
      expect(result.detected).toBe('unknown');
      expect(result.accepted).toBe(false);
    });

    it('空 Blob は unknown として拒否される', async () => {
      const blob = new Blob([]);
      const result = await validateMagicBytes(blob);
      expect(result.detected).toBe('unknown');
      expect(result.accepted).toBe(false);
    });
  });

  describe('allowedFormats カスタム指定', () => {
    it('空の allowedFormats では全て accepted=false', async () => {
      const blob = loadFixtureAsBlob('jpeg-with-gps.jpg');
      const result = await validateMagicBytes(blob, []);
      expect(result.accepted).toBe(false);
    });

    it('jpeg のみ許可で webp は accepted=false', async () => {
      const blob = loadFixtureAsBlob('webp-with-exif.webp');
      const result = await validateMagicBytes(blob, ['jpeg']);
      expect(result.accepted).toBe(false);
    });
  });
});
