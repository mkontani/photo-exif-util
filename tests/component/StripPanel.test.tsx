import type { ExifSummary } from '@/core/exif/types';
import { StripPanel } from '@/ui/components/StripPanel';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const mockBlob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

const mockSummary: ExifSummary = {
  format: 'jpeg',
  fields: [
    {
      key: 'GPSLatitude',
      category: 'gps',
      risk: 'high',
      displayValue: '35.6895',
      rawValue: 35.6895,
    },
    {
      key: 'Make',
      category: 'device',
      risk: 'low',
      displayValue: 'Canon',
      rawValue: 'Canon',
    },
  ],
  hasGps: true,
  highestRisk: 'high',
};

describe('StripPanel', () => {
  it('カテゴリチェックボックスが 7 個表示される', () => {
    const { container } = render(() => <StripPanel blob={mockBlob} summary={mockSummary} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // 7 カテゴリ + ICC トグル = 8
    expect(checkboxes.length).toBeGreaterThanOrEqual(7);
  });

  it('"EXIF を削除" ボタンが表示される', () => {
    const { getByRole } = render(() => <StripPanel blob={mockBlob} summary={mockSummary} />);
    const btn = getByRole('button', { name: /EXIF を削除|strip|削除/i });
    expect(btn).toBeTruthy();
  });

  it('GPS カテゴリチェックボックスが存在する', () => {
    const { getByLabelText } = render(() => <StripPanel blob={mockBlob} summary={mockSummary} />);
    const gpsCheckbox = getByLabelText(/GPS/i);
    expect(gpsCheckbox).toBeTruthy();
  });

  it('チェックボックスをクリックで選択状態が変わる', () => {
    const { getByLabelText } = render(() => <StripPanel blob={mockBlob} summary={mockSummary} />);
    const gpsCheckbox = getByLabelText(/GPS/i) as HTMLInputElement;
    expect(gpsCheckbox.checked).toBe(false);
    fireEvent.click(gpsCheckbox);
    expect(gpsCheckbox.checked).toBe(true);
  });

  it('"全選択" ボタンで全チェックボックスが選択される', () => {
    const { getByRole, container } = render(() => (
      <StripPanel blob={mockBlob} summary={mockSummary} />
    ));
    const selectAllBtn = getByRole('button', { name: /全選択/i });
    fireEvent.click(selectAllBtn);
    // カテゴリチェックボックス (ICC 除く 7 個) がすべて checked
    const categoryCheckboxes = container.querySelectorAll('input[type="checkbox"][data-category]');
    for (const cb of categoryCheckboxes) {
      expect((cb as HTMLInputElement).checked).toBe(true);
    }
  });

  it('"全解除" ボタンで全チェックボックスが解除される', () => {
    const { getByRole, container } = render(() => (
      <StripPanel blob={mockBlob} summary={mockSummary} />
    ));
    // まず全選択
    fireEvent.click(getByRole('button', { name: /全選択/i }));
    // 全解除
    const clearAllBtn = getByRole('button', { name: /全解除/i });
    fireEvent.click(clearAllBtn);
    const categoryCheckboxes = container.querySelectorAll('input[type="checkbox"][data-category]');
    for (const cb of categoryCheckboxes) {
      expect((cb as HTMLInputElement).checked).toBe(false);
    }
  });

  it('"ICC を保持" チェックボックスがデフォルトで checked', () => {
    const { getByLabelText } = render(() => <StripPanel blob={mockBlob} summary={mockSummary} />);
    const iccCheckbox = getByLabelText(/ICC/i) as HTMLInputElement;
    expect(iccCheckbox.checked).toBe(true);
  });
});

describe('StripPanel - stripExif モック', () => {
  it('stripExif モジュールをモックして実行完了後にダウンロードボタンが表示される', async () => {
    // stripExif を mock: 実際の JPEG 処理は重いため DI で分離
    const mockStripExif = vi.fn().mockResolvedValue({
      blob: new Blob(['stripped'], { type: 'image/jpeg' }),
      removedKeys: ['GPSLatitude', 'GPSLongitude'],
      format: 'jpeg',
    });

    const { getByRole, findByRole } = render(() => (
      <StripPanel blob={mockBlob} summary={mockSummary} onStripExif={mockStripExif} />
    ));

    // 全選択してから実行
    fireEvent.click(getByRole('button', { name: /全選択/i }));
    fireEvent.click(getByRole('button', { name: /EXIF を削除|削除/i }));

    // ダウンロードボタンが表示されるのを待つ
    const downloadBtn = await findByRole('button', { name: /ダウンロード/i });
    expect(downloadBtn).toBeTruthy();
    expect(mockStripExif).toHaveBeenCalledOnce();
  });

  it('onComplete コールバックが呼ばれる', async () => {
    const mockResult = {
      blob: new Blob(['stripped'], { type: 'image/jpeg' }),
      removedKeys: ['GPSLatitude'],
      format: 'jpeg' as const,
    };
    const mockStripExif = vi.fn().mockResolvedValue(mockResult);
    const onComplete = vi.fn();

    const { getByRole } = render(() => (
      <StripPanel
        blob={mockBlob}
        summary={mockSummary}
        onStripExif={mockStripExif}
        onComplete={onComplete}
      />
    ));

    fireEvent.click(getByRole('button', { name: /全選択/i }));
    fireEvent.click(getByRole('button', { name: /EXIF を削除|削除/i }));

    // onComplete が呼ばれるまで待つ
    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(mockResult);
    });
  });
});
