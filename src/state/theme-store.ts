/**
 * テーマ解決ユーティリティ。
 * prefers-color-scheme と設定値から実際に適用するテーマを決定する。
 */
import type { ThemeMode } from './settings-store';

/**
 * theme=auto + system の prefers-color-scheme を解決して 'light'|'dark' を返す純粋関数。
 * theme が 'light'|'dark' ならシステムの値は無視する。
 *
 * @param mode ユーザー設定のテーマモード
 * @param prefersDark window.matchMedia('(prefers-color-scheme: dark)').matches の値
 */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  // auto: システム設定に従う
  return prefersDark ? 'dark' : 'light';
}
