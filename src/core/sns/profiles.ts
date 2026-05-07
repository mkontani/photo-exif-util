/**
 * SNS プロファイル定数。
 * 各 SNS の推奨画像仕様に基づいた不変定数として定義する。
 * 実行時に変更されないことを型レベルで保証するため readonly を徹底する。
 */
import type { SnsProfile } from './types';

/**
 * 全 SNS プロファイルのリスト。
 * テーブル順は UI 表示順にも使われる想定。
 */
export const SNS_PROFILES: readonly SnsProfile[] = [
  {
    id: 'x-post',
    label: 'X (Twitter) Post',
    maxWidth: 4096,
    maxHeight: 4096,
    maxFileSizeKB: 5120,
    preferredFormat: 'jpeg',
    defaultQuality: 85,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'x-card',
    label: 'X (Twitter) Card',
    maxWidth: 1200,
    maxHeight: 628,
    aspectRatio: { w: 1200, h: 628, mode: 'cover' },
    maxFileSizeKB: 5120,
    preferredFormat: 'jpeg',
    defaultQuality: 85,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'ig-square',
    label: 'Instagram Square',
    maxWidth: 1080,
    maxHeight: 1080,
    aspectRatio: { w: 1, h: 1, mode: 'cover' },
    preferredFormat: 'jpeg',
    defaultQuality: 90,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'ig-portrait',
    label: 'Instagram Portrait',
    maxWidth: 1080,
    maxHeight: 1350,
    aspectRatio: { w: 4, h: 5, mode: 'cover' },
    preferredFormat: 'jpeg',
    defaultQuality: 90,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'ig-story',
    label: 'Instagram Story',
    maxWidth: 1080,
    maxHeight: 1920,
    aspectRatio: { w: 9, h: 16, mode: 'cover' },
    preferredFormat: 'jpeg',
    defaultQuality: 90,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'threads-post',
    label: 'Threads Post',
    maxWidth: 1440,
    maxHeight: 1440,
    preferredFormat: 'jpeg',
    defaultQuality: 88,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'line-talk',
    label: 'LINE Talk',
    maxWidth: 1024,
    maxHeight: 1024,
    maxFileSizeKB: 1024,
    preferredFormat: 'jpeg',
    defaultQuality: 85,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'line-timeline',
    label: 'LINE Timeline',
    maxWidth: 1080,
    maxHeight: 1080,
    maxFileSizeKB: 5120,
    preferredFormat: 'jpeg',
    defaultQuality: 88,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'bluesky-post',
    label: 'Bluesky Post',
    maxWidth: 2000,
    maxHeight: 2000,
    // Bluesky AT Protocol の上限は 1,000,000 bytes (10^6) なので KiB 換算で 976.5
    // → 安全マージン込みで 976 KiB (1,000,000 bytes 未満) を採用
    maxFileSizeKB: 976,
    preferredFormat: 'jpeg',
    defaultQuality: 85,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'fb-post',
    label: 'Facebook Post',
    maxWidth: 2048,
    maxHeight: 2048,
    preferredFormat: 'jpeg',
    defaultQuality: 88,
    stripExif: true,
    defaultStripCategories: 'all',
  },
  {
    id: 'custom',
    label: 'Custom',
    maxWidth: 0,
    maxHeight: 0,
    preferredFormat: 'jpeg',
    defaultQuality: 85,
    stripExif: true,
    defaultStripCategories: 'all',
  },
] as const;

/**
 * id でプロファイルを検索するヘルパー。
 * 見つからない場合は undefined を返す (例外を throw しない)。
 */
export function getProfileById(id: string): SnsProfile | undefined {
  return SNS_PROFILES.find((p) => p.id === id);
}
