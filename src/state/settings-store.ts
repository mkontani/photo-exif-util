/**
 * Options page の設定状態管理。
 * reducer は純粋関数として分離し、chrome.storage との I/O とは切り離している。
 */
import { SNS_PROFILES } from '@/core/sns/profiles';

export type ThemeMode = 'auto' | 'light' | 'dark';

/** 有効な ThemeMode の集合 (バリデーション用) */
const VALID_THEMES: readonly ThemeMode[] = ['auto', 'light', 'dark'];

export interface Settings {
  readonly defaultProfileId: string;
  readonly theme: ThemeMode;
}

/** デフォルト設定。SNS_PROFILES の最初のプロファイルを初期値にする */
export const defaultSettings: Settings = {
  defaultProfileId: 'x-post',
  theme: 'auto',
} as const;

export type SettingsAction =
  | { type: 'SET_DEFAULT_PROFILE'; profileId: string }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'LOAD'; settings: Settings }
  | { type: 'RESET' };

/**
 * Settings の純粋 reducer。
 * 元の state を変更せず常に新しいオブジェクトを返す。
 */
export function settingsReducer(state: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'SET_DEFAULT_PROFILE':
      return { ...state, defaultProfileId: action.profileId };

    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'LOAD':
      return { ...action.settings };

    case 'RESET':
      return { ...defaultSettings };
  }
}

/**
 * 永続化データを検証して有効な Settings を返す純粋関数。
 * 不正なフィールドは defaultSettings の値でフォールバックする。
 *
 * chrome.storage から読み込んだ生データを安全に型変換するために使用する。
 */
export function validateSettings(input: unknown): Settings {
  // null / undefined / 非 object (配列含む) → デフォルト
  if (input === null || input === undefined || typeof input !== 'object' || Array.isArray(input)) {
    return { ...defaultSettings };
  }

  const raw = input as Record<string, unknown>;

  // theme の検証
  const rawTheme = raw.theme;
  const theme: ThemeMode =
    typeof rawTheme === 'string' && (VALID_THEMES as readonly string[]).includes(rawTheme)
      ? (rawTheme as ThemeMode)
      : defaultSettings.theme;

  // defaultProfileId の検証 (SNS_PROFILES に実在する id のみ受け入れる)
  const rawProfileId = raw.defaultProfileId;
  const isKnownProfile =
    typeof rawProfileId === 'string' && SNS_PROFILES.some((p) => p.id === rawProfileId);
  const defaultProfileId: string = isKnownProfile
    ? (rawProfileId as string)
    : defaultSettings.defaultProfileId;

  return { theme, defaultProfileId };
}
