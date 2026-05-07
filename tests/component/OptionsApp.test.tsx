/**
 * OptionsApp コンポーネントの実コンポーネントテスト。
 * src/ui/options/OptionsApp.tsx を直接 import し、
 * chrome.storage をモックして DOM 上の振る舞いを検証する。
 */
import { setI18nTestDict } from '@/ui/i18n/t';
import { OptionsApp } from '@/ui/options/OptionsApp';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// chrome.storage.local をモックする
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
  i18n: {
    getMessage: (key: string) => key,
  },
});

// SNS_PROFILES のモック (Options UI で必要)
vi.mock('@/core/sns/profiles', () => ({
  SNS_PROFILES: [
    { id: 'twitter', label: 'Twitter/X' },
    { id: 'instagram', label: 'Instagram' },
  ],
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OptionsApp — 実コンポーネントテスト', () => {
  beforeEach(() => {
    setI18nTestDict({
      options_title: 'Settings',
      options_default_profile: 'Default SNS Profile',
      options_theme: 'Theme',
      theme_auto: 'Auto',
      theme_light: 'Light',
      theme_dark: 'Dark',
      options_saved: 'Settings saved',
      options_save_error: 'Failed to save: $1',
    });
    // デフォルト: get は空、set は成功
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setI18nTestDict(null);
  });

  it('ページタイトルを表示する', async () => {
    const { getByRole } = render(() => <OptionsApp />);
    expect(getByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  it('chrome.storage.local.get を onMount 時に呼び出す', async () => {
    render(() => <OptionsApp />);
    await waitFor(() => {
      expect(mockStorageGet).toHaveBeenCalledWith('settings');
    });
  });

  it('保存済み設定をロードしてセレクトに反映する', async () => {
    mockStorageGet.mockResolvedValue({
      settings: { defaultProfileId: 'instagram', theme: 'auto' },
    });

    const { getByRole } = render(() => <OptionsApp />);

    await waitFor(() => {
      const select = getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('instagram');
    });
  });

  it('プロファイルを変更すると chrome.storage.local.set を呼び出す', async () => {
    mockStorageGet.mockResolvedValue({
      settings: { defaultProfileId: 'twitter', theme: 'auto' },
    });

    const { getByRole } = render(() => <OptionsApp />);

    await waitFor(() => {
      expect(mockStorageGet).toHaveBeenCalled();
    });

    const select = getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'instagram' } });

    await waitFor(() => {
      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ defaultProfileId: 'instagram' }),
        }),
      );
    });
  });

  it('テーマを変更すると chrome.storage.local.set を呼び出す', async () => {
    mockStorageGet.mockResolvedValue({
      settings: { defaultProfileId: 'twitter', theme: 'auto' },
    });

    const { getAllByRole } = render(() => <OptionsApp />);

    await waitFor(() => {
      expect(mockStorageGet).toHaveBeenCalled();
    });

    // theme ラジオボタン (Light) をクリック
    const radios = getAllByRole('radio') as HTMLInputElement[];
    const lightRadio = radios.find((r) => r.value === 'light');
    if (!lightRadio) throw new Error('light radio not found');
    fireEvent.click(lightRadio);

    await waitFor(() => {
      expect(mockStorageSet).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ theme: 'light' }),
        }),
      );
    });
  });

  it('保存成功後に "Settings saved" を表示する', async () => {
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockResolvedValue(undefined);

    const { getByRole, queryByText } = render(() => <OptionsApp />);

    await waitFor(() => {
      expect(mockStorageGet).toHaveBeenCalled();
    });

    const select = getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'instagram' } });

    await waitFor(() => {
      expect(queryByText('Settings saved')).toBeTruthy();
    });
  });

  it('chrome.storage.local.set が失敗したとき赤バナーを表示する', async () => {
    mockStorageGet.mockResolvedValue({});
    mockStorageSet.mockRejectedValue(new Error('QuotaExceeded'));

    const { getByRole } = render(() => <OptionsApp />);

    await waitFor(() => {
      expect(mockStorageGet).toHaveBeenCalled();
    });

    const select = getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'instagram' } });

    await waitFor(() => {
      // role="alert" の要素が表示される
      const alert = getByRole('alert');
      expect(alert).toBeTruthy();
      expect(alert.textContent).toContain('QuotaExceeded');
    });
  });
});
