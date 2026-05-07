/**
 * Options page の UI コンポーネント。
 * デフォルトプロファイルとテーマの 2 項目を chrome.storage.local に永続化する。
 *
 * main.tsx から分離することでテスト環境での直接 import を可能にしている。
 * chrome.storage / chrome.i18n 依存のため coverage exclude 対象 (src/ui/** に含まれる)。
 */
import { SNS_PROFILES } from '@/core/sns/profiles';
import { defaultSettings, settingsReducer, validateSettings } from '@/state/settings-store';
import type { Settings, SettingsAction, ThemeMode } from '@/state/settings-store';
import { resolveTheme } from '@/state/theme-store';
import { t } from '@/ui/i18n/t';
import { extractErrorInfo } from '@/utils/error';
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';

export function OptionsApp() {
  const [settings, setSettings] = createSignal<Settings>(defaultSettings);
  const [saved, setSaved] = createSignal(false);
  // 保存失敗時のエラーメッセージ (null = エラーなし)
  const [saveError, setSaveError] = createSignal<string | null>(null);

  // setTimeout のリーク防止: アンマウント時にクリアする
  let savedTimer: ReturnType<typeof setTimeout> | undefined;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (savedTimer !== undefined) clearTimeout(savedTimer);
    if (errorTimer !== undefined) clearTimeout(errorTimer);
  });

  function dispatch(action: SettingsAction) {
    setSettings((s) => settingsReducer(s, action));
  }

  async function loadSettings(): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      const raw = await chrome.storage.local.get('settings');
      const loaded = validateSettings(raw.settings);
      dispatch({ type: 'LOAD', settings: loaded });

      // テーマを適用する
      applyTheme(loaded);
    } catch {
      // storage アクセス失敗時はデフォルトを使う
    }
  }

  function applyTheme(s: Settings): void {
    // jsdom 環境では matchMedia が存在しないため安全にフォールバックする
    const prefersDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = resolveTheme(s.theme, prefersDark);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolved;
    }
  }

  async function saveSettings(newSettings: Settings): Promise<void> {
    setSaveError(null);
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      await chrome.storage.local.set({ settings: newSettings });
      setSaved(true);
      // 既存の savedTimer をクリアして再設定 (連続保存対応)
      if (savedTimer !== undefined) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => setSaved(false), 2000);
    } catch (cause) {
      // 保存失敗時: エラー内容をユーザーに通知して 5 秒後に消す
      const { message } = extractErrorInfo(cause, 'STORAGE_ERROR');
      setSaveError(t('options_save_error', [message], `保存に失敗しました: ${message}`));
      if (errorTimer !== undefined) clearTimeout(errorTimer);
      errorTimer = setTimeout(() => setSaveError(null), 5000);
    }
  }

  async function handleThemeChange(theme: ThemeMode): Promise<void> {
    // reducer を 1 回だけ呼んで結果を signal/apply/save 全てに使い回す
    const next = settingsReducer(settings(), { type: 'SET_THEME', theme });
    dispatch({ type: 'LOAD', settings: next });
    applyTheme(next);
    await saveSettings(next);
  }

  async function handleProfileChange(profileId: string): Promise<void> {
    const next = settingsReducer(settings(), { type: 'SET_DEFAULT_PROFILE', profileId });
    dispatch({ type: 'LOAD', settings: next });
    await saveSettings(next);
  }

  onMount(() => {
    loadSettings();
  });

  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: 'auto', label: t('theme_auto', undefined, 'Auto') },
    { value: 'light', label: t('theme_light', undefined, 'Light') },
    { value: 'dark', label: t('theme_dark', undefined, 'Dark') },
  ];

  return (
    <div class="mx-auto max-w-lg p-6">
      <h1 class="mb-6 text-xl font-bold">{t('options_title', undefined, 'Settings')}</h1>

      {/* デフォルト SNS プロファイル */}
      <section class="mb-6">
        <label class="mb-2 block text-sm font-medium" for="default-profile">
          {t('options_default_profile', undefined, 'Default SNS Profile')}
        </label>
        <select
          id="default-profile"
          class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          value={settings().defaultProfileId}
          onChange={(e) => handleProfileChange(e.currentTarget.value)}
        >
          <For each={SNS_PROFILES}>
            {(profile) => <option value={profile.id}>{profile.label}</option>}
          </For>
        </select>
      </section>

      {/* テーマ選択 */}
      <section class="mb-6">
        <p class="mb-2 text-sm font-medium">{t('options_theme', undefined, 'Theme')}</p>
        <div class="flex flex-col gap-2">
          <For each={themeOptions}>
            {(option) => (
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={settings().theme === option.value}
                  onChange={() => handleThemeChange(option.value)}
                />
                {option.label}
              </label>
            )}
          </For>
        </div>
      </section>

      {/* 保存完了メッセージ: <output> は role="status" を暗黙に持つ */}
      <Show when={saved()}>
        <output class="text-sm text-green-600">
          {t('options_saved', undefined, 'Settings saved')}
        </output>
      </Show>

      {/* 保存失敗エラー: role="alert" でスクリーンリーダーに即時通知 */}
      <Show when={saveError()}>
        <div
          role="alert"
          class="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {saveError()}
        </div>
      </Show>
    </div>
  );
}
