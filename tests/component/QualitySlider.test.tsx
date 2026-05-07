import { QualitySlider } from '@/ui/components/QualitySlider';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

describe('QualitySlider', () => {
  it('スライダーが表示される', () => {
    const { container } = render(() => <QualitySlider value={85} onChange={vi.fn()} />);
    const slider = container.querySelector('input[type="range"]');
    expect(slider).not.toBeNull();
  });

  it('value が反映される', () => {
    const { container } = render(() => <QualitySlider value={75} onChange={vi.fn()} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe('75');
  });

  it('現在値が表示される', () => {
    const { getByText } = render(() => <QualitySlider value={85} onChange={vi.fn()} />);
    expect(getByText('85')).toBeTruthy();
  });

  it('スライダー変更で onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const { container } = render(() => <QualitySlider value={85} onChange={onChange} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.input(slider, { target: { value: '70' } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(70);
  });

  it('デフォルト min は 0 (Phase 3 quality-search の minQuality と整合)', () => {
    const { container } = render(() => <QualitySlider value={85} onChange={vi.fn()} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe('0');
  });

  it('デフォルト max は 100', () => {
    const { container } = render(() => <QualitySlider value={85} onChange={vi.fn()} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('100');
  });

  it('カスタム min が反映される', () => {
    const { container } = render(() => <QualitySlider value={50} onChange={vi.fn()} min={10} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe('10');
  });

  it('カスタム max が反映される', () => {
    const { container } = render(() => <QualitySlider value={50} onChange={vi.fn()} max={90} />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('90');
  });

  it('value=0 のとき 0 が表示される', () => {
    const { getByText } = render(() => <QualitySlider value={0} onChange={vi.fn()} min={0} />);
    expect(getByText('0')).toBeTruthy();
  });

  it('value=100 のとき 100 が表示される', () => {
    const { getByText } = render(() => <QualitySlider value={100} onChange={vi.fn()} />);
    expect(getByText('100')).toBeTruthy();
  });
});
