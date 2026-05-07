import { Tabs } from '@/ui/components/Tabs';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const testTabs = [
  { id: 'inspect', label: '検査' },
  { id: 'strip', label: '削除' },
  { id: 'optimize', label: '最適化' },
] as const;

describe('Tabs', () => {
  it('全タブが表示される', () => {
    const { getByText } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={vi.fn()} />
    ));
    expect(getByText('検査')).toBeTruthy();
    expect(getByText('削除')).toBeTruthy();
    expect(getByText('最適化')).toBeTruthy();
  });

  it('active タブの aria-selected が true', () => {
    const { getByText } = render(() => <Tabs tabs={testTabs} active="strip" onChange={vi.fn()} />);
    const activeTab = getByText('削除');
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
  });

  it('非 active タブの aria-selected が false', () => {
    const { getByText } = render(() => <Tabs tabs={testTabs} active="strip" onChange={vi.fn()} />);
    const inactiveTab = getByText('検査');
    expect(inactiveTab.getAttribute('aria-selected')).toBe('false');
  });

  it('タブリストに role="tablist" が設定されている', () => {
    const { container } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={vi.fn()} />
    ));
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
  });

  it('各タブに role="tab" が設定されている', () => {
    const { container } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={vi.fn()} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);
  });

  it('タブをクリックすると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const { getByText } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={onChange} />
    ));
    fireEvent.click(getByText('削除'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('strip');
  });

  it('active タブをクリックしても onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const { getByText } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={onChange} />
    ));
    fireEvent.click(getByText('検査'));
    expect(onChange).toHaveBeenCalledWith('inspect');
  });

  it('ArrowRight キーで次のタブに onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={onChange} />
    ));
    const firstTab = container.querySelectorAll('[role="tab"]')[0] as HTMLElement;
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('strip');
  });

  it('ArrowLeft キーで前のタブに onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const { container } = render(() => <Tabs tabs={testTabs} active="strip" onChange={onChange} />);
    const stripTab = container.querySelectorAll('[role="tab"]')[1] as HTMLElement;
    fireEvent.keyDown(stripTab, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('inspect');
  });

  it('最後のタブで ArrowRight を押すと最初に戻る', () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <Tabs tabs={testTabs} active="optimize" onChange={onChange} />
    ));
    const lastTab = container.querySelectorAll('[role="tab"]')[2] as HTMLElement;
    fireEvent.keyDown(lastTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('inspect');
  });

  it('最初のタブで ArrowLeft を押すと最後に戻る', () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <Tabs tabs={testTabs} active="inspect" onChange={onChange} />
    ));
    const firstTab = container.querySelectorAll('[role="tab"]')[0] as HTMLElement;
    fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('optimize');
  });
});
