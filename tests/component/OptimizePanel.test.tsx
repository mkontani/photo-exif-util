import type { SnsApplyResult } from '@/core/sns/types';
import { OptimizePanel } from '@/ui/components/OptimizePanel';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const mockBlob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

describe('OptimizePanel', () => {
  it('プロファイル選択が表示される', () => {
    const { container } = render(() => <OptimizePanel blob={mockBlob} />);
    // select または radio button が存在する
    const profileSelect =
      container.querySelector('select') ?? container.querySelector('input[type="radio"]');
    expect(profileSelect).not.toBeNull();
  });

  it('Quality スライダーが表示される', () => {
    const { container } = render(() => <OptimizePanel blob={mockBlob} />);
    const slider = container.querySelector('input[type="range"]');
    expect(slider).not.toBeNull();
  });

  it('"最適化して書き出し" ボタンが表示される', () => {
    const { getByRole } = render(() => <OptimizePanel blob={mockBlob} />);
    const btn = getByRole('button', { name: /最適化|書き出し/i });
    expect(btn).toBeTruthy();
  });

  it('プロファイル変更で選択が更新される (select の場合)', () => {
    const { container } = render(() => <OptimizePanel blob={mockBlob} />);
    const select = container.querySelector('select');
    if (select) {
      fireEvent.change(select, { target: { value: 'ig-square' } });
      expect((select as HTMLSelectElement).value).toBe('ig-square');
    }
    // radio の場合は別テストで対応
  });

  it('Quality スライダーを変更できる', () => {
    const { container } = render(() => <OptimizePanel blob={mockBlob} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.input(slider, { target: { value: '70' } });
    expect(slider.value).toBe('70');
  });
});

describe('OptimizePanel - applySnsProfile モック', () => {
  it('applySnsProfile モックで実行完了後にダウンロードボタンが表示される', async () => {
    const mockResult: SnsApplyResult = {
      blob: new Blob(['optimized'], { type: 'image/jpeg' }),
      outputDimensions: { width: 1080, height: 1080 },
      outputFormat: 'jpeg',
      outputSizeBytes: 102400,
      quality: 85,
      profileId: 'ig-square',
      removedExifKeys: ['GPSLatitude'],
      sizeTargetReached: true,
    };
    const mockApply = vi.fn().mockResolvedValue(mockResult);

    const { getByRole, findByRole } = render(() => (
      <OptimizePanel blob={mockBlob} onApply={mockApply} />
    ));

    fireEvent.click(getByRole('button', { name: /最適化|書き出し/i }));

    const downloadBtn = await findByRole('button', { name: /ダウンロード/i });
    expect(downloadBtn).toBeTruthy();
    expect(mockApply).toHaveBeenCalledOnce();
  });

  it('実行完了後に outputDimensions が表示される', async () => {
    const mockResult: SnsApplyResult = {
      blob: new Blob(['optimized'], { type: 'image/jpeg' }),
      outputDimensions: { width: 1200, height: 800 },
      outputFormat: 'jpeg',
      outputSizeBytes: 204800,
      quality: 85,
      profileId: 'x-post',
      removedExifKeys: [],
      sizeTargetReached: true,
    };
    const mockApply = vi.fn().mockResolvedValue(mockResult);

    const { getByRole, findByText } = render(() => (
      <OptimizePanel blob={mockBlob} onApply={mockApply} />
    ));

    fireEvent.click(getByRole('button', { name: /最適化|書き出し/i }));

    // 寸法表示を待つ
    const dimensionText = await findByText(/1200/);
    expect(dimensionText).toBeTruthy();
  });

  it('onComplete コールバックが呼ばれる', async () => {
    const mockResult: SnsApplyResult = {
      blob: new Blob(['optimized'], { type: 'image/jpeg' }),
      outputDimensions: { width: 1080, height: 1080 },
      outputFormat: 'jpeg',
      outputSizeBytes: 102400,
      quality: 85,
      profileId: 'ig-square',
      removedExifKeys: [],
      sizeTargetReached: true,
    };
    const mockApply = vi.fn().mockResolvedValue(mockResult);
    const onComplete = vi.fn();

    const { getByRole } = render(() => (
      <OptimizePanel blob={mockBlob} onApply={mockApply} onComplete={onComplete} />
    ));

    fireEvent.click(getByRole('button', { name: /最適化|書き出し/i }));

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(mockResult);
    });
  });
});
