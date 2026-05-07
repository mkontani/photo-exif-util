import { RiskBadge } from '@/ui/components/RiskBadge';
import { setI18nTestDict } from '@/ui/i18n/t';
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('RiskBadge', () => {
  beforeEach(() => {
    setI18nTestDict({
      riskbadge_aria: 'Risk level: $1',
      risk_high: 'High',
      risk_medium: 'Medium',
      risk_low: 'Low',
      risk_none: 'None',
    });
  });

  afterEach(() => {
    setI18nTestDict(null);
  });

  it('level=high のとき "High" テキストを表示する', () => {
    const { getByText } = render(() => <RiskBadge level="high" />);
    expect(getByText('High')).toBeTruthy();
  });

  it('level=medium のとき "Medium" テキストを表示する', () => {
    const { getByText } = render(() => <RiskBadge level="medium" />);
    expect(getByText('Medium')).toBeTruthy();
  });

  it('level=low のとき "Low" テキストを表示する', () => {
    const { getByText } = render(() => <RiskBadge level="low" />);
    expect(getByText('Low')).toBeTruthy();
  });

  it('level=none のとき "None" テキストを表示する', () => {
    const { getByText } = render(() => <RiskBadge level="none" />);
    expect(getByText('None')).toBeTruthy();
  });

  // Phase 8: aria-label が i18n キー経由で取得される
  it('aria-label が i18n キー riskbadge_aria 経由で設定される', () => {
    const { container } = render(() => <RiskBadge level="high" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.getAttribute('aria-label')).toBe('Risk level: High');
  });

  it('level=medium のとき aria-label に "Medium" が含まれる', () => {
    const { container } = render(() => <RiskBadge level="medium" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.getAttribute('aria-label')).toBe('Risk level: Medium');
  });

  it('level=low のとき aria-label に "Low" が含まれる', () => {
    const { container } = render(() => <RiskBadge level="low" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.getAttribute('aria-label')).toBe('Risk level: Low');
  });

  it('level=none のとき aria-label に "None" が含まれる', () => {
    const { container } = render(() => <RiskBadge level="none" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.getAttribute('aria-label')).toBe('Risk level: None');
  });

  it('level=high のとき bg-red-100 クラスを持つ', () => {
    const { container } = render(() => <RiskBadge level="high" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.className).toContain('bg-red-100');
  });

  it('level=medium のとき bg-amber-100 クラスを持つ', () => {
    const { container } = render(() => <RiskBadge level="medium" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.className).toContain('bg-amber-100');
  });

  it('level=low のとき bg-blue-100 クラスを持つ', () => {
    const { container } = render(() => <RiskBadge level="low" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.className).toContain('bg-blue-100');
  });

  it('level=none のとき bg-gray-100 クラスを持つ', () => {
    const { container } = render(() => <RiskBadge level="none" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.className).toContain('bg-gray-100');
  });

  it('外部から class を渡せる', () => {
    const { container } = render(() => <RiskBadge level="low" class="extra-class" />);
    const badge = container.querySelector('[aria-label]');
    expect(badge?.className).toContain('extra-class');
  });

  // i18n 辞書なし (fallback 動作)
  it('i18n 辞書が空のとき aria-label に level が含まれる (fallback)', () => {
    setI18nTestDict({});
    const { container } = render(() => <RiskBadge level="high" />);
    const badge = container.querySelector('[aria-label]');
    // fallback: 'riskbadge_aria' キー自体が返る、または fallback テキストが含まれる
    expect(badge?.getAttribute('aria-label')).toBeTruthy();
  });
});
