import type { ExifSummary } from '@/core/exif/types';
import { ExifTable } from '@/ui/components/ExifTable';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

const emptySummary: ExifSummary = {
  format: 'jpeg',
  fields: [],
  hasGps: false,
  highestRisk: 'none',
};

const sampleSummary: ExifSummary = {
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
      key: 'GPSLongitude',
      category: 'gps',
      risk: 'high',
      displayValue: '139.6917',
      rawValue: 139.6917,
    },
    {
      key: 'Make',
      category: 'device',
      risk: 'low',
      displayValue: 'Canon',
      rawValue: 'Canon',
    },
    {
      key: 'DateTime',
      category: 'datetime',
      risk: 'medium',
      displayValue: '2024-01-01T00:00:00',
      rawValue: '2024:01:01 00:00:00',
    },
  ],
  hasGps: true,
  highestRisk: 'high',
};

describe('ExifTable', () => {
  it('fields が空なら "EXIF データなし" を表示する', () => {
    const { getByText } = render(() => <ExifTable summary={emptySummary} />);
    expect(getByText(/EXIF データなし/)).toBeTruthy();
  });

  it('fields が 1 件以上なら table row が描画される', () => {
    const { getAllByRole } = render(() => <ExifTable summary={sampleSummary} />);
    // thead の tr + tbody の tr 合計 5 行以上
    const rows = getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('全フィールドのキーが表示される', () => {
    const { getByText } = render(() => <ExifTable summary={sampleSummary} />);
    expect(getByText('GPSLatitude')).toBeTruthy();
    expect(getByText('Make')).toBeTruthy();
  });

  it('検索ボックスに入力すると filter が適用される', async () => {
    const { getByRole, queryByText } = render(() => <ExifTable summary={sampleSummary} />);
    const searchInput = getByRole('searchbox');
    fireEvent.input(searchInput, { target: { value: 'Make' } });
    // Make は残り、GPSLatitude は消える
    expect(queryByText('GPSLatitude')).toBeNull();
    expect(queryByText('Make')).toBeTruthy();
  });

  it('検索結果が 0 件なら "該当なし" を表示する', () => {
    const { getByRole, getByText } = render(() => <ExifTable summary={sampleSummary} />);
    const searchInput = getByRole('searchbox');
    fireEvent.input(searchInput, { target: { value: 'NoSuchField' } });
    expect(getByText(/該当なし/)).toBeTruthy();
  });

  it('カテゴリボタンで絞り込みができる', () => {
    const { getByRole, queryByText, getByText } = render(() => (
      <ExifTable summary={sampleSummary} />
    ));
    // gps カテゴリボタンをクリック
    const gpsButton = getByRole('button', { name: /gps/i });
    fireEvent.click(gpsButton);
    // GPS 系は残る
    expect(getByText('GPSLatitude')).toBeTruthy();
    // device カテゴリの Make は消える
    expect(queryByText('Make')).toBeNull();
  });

  it('displayValue が表示される', () => {
    const { getByText } = render(() => <ExifTable summary={sampleSummary} />);
    expect(getByText('35.6895')).toBeTruthy();
  });

  it('RiskBadge が各行に表示される', () => {
    const { getAllByLabelText } = render(() => <ExifTable summary={sampleSummary} />);
    // 各フィールドに対して risk レベルのラベルが存在する
    const badges = getAllByLabelText(/risk level/i);
    expect(badges.length).toBe(4);
  });
});
