/**
 * Side Panel の strip ルートに対応する状態管理。
 * reducer は純粋関数として定義し、Solid createSignal から呼び出す。
 */
import type { StripCategory, StripResult } from '@/core/exif/strip';

/** strip 対象の ExifCategory 一覧 (icc は別管理) */
const STRIP_CATEGORIES: readonly StripCategory[] = [
  'gps',
  'device',
  'lens',
  'capture',
  'datetime',
  'software',
  'orientation',
] as const;

/** strip ルートの状態 */
export interface StripState {
  readonly status: 'idle' | 'running' | 'success' | 'error';
  /** 削除対象として選択されたカテゴリ */
  readonly selectedCategories: readonly StripCategory[];
  /** ICC プロファイルを残すか */
  readonly keepIcc: boolean;
  readonly result?: StripResult;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export const initialStripState: StripState = {
  status: 'idle',
  selectedCategories: [],
  keepIcc: true,
};

export type StripAction =
  | { type: 'TOGGLE_CATEGORY'; category: StripCategory }
  | { type: 'SELECT_ALL' }
  | { type: 'SELECT_NONE' }
  | { type: 'TOGGLE_KEEP_ICC' }
  | { type: 'STRIP_START' }
  | { type: 'STRIP_SUCCESS'; result: StripResult }
  | { type: 'STRIP_ERROR'; code: string; message: string }
  | { type: 'RESET' };

/**
 * 純粋な reducer。
 * 元の state を変更せず常に新しいオブジェクトを返す。
 */
export function stripReducer(state: StripState, action: StripAction): StripState {
  switch (action.type) {
    case 'TOGGLE_CATEGORY': {
      const already = state.selectedCategories.includes(action.category);
      return {
        ...state,
        selectedCategories: already
          ? state.selectedCategories.filter((c) => c !== action.category)
          : [...state.selectedCategories, action.category],
      };
    }

    case 'SELECT_ALL':
      return {
        ...state,
        selectedCategories: [...STRIP_CATEGORIES],
      };

    case 'SELECT_NONE':
      return {
        ...state,
        selectedCategories: [],
      };

    case 'TOGGLE_KEEP_ICC':
      return {
        ...state,
        keepIcc: !state.keepIcc,
      };

    case 'STRIP_START': {
      // exactOptionalPropertyTypes: undefined を明示的にセットする代わりにキーを除外する
      const { result: _r, errorCode: _ec, errorMessage: _em, ...rest } = state;
      return {
        ...rest,
        status: 'running',
      };
    }

    case 'STRIP_SUCCESS': {
      const { errorCode: _ec, errorMessage: _em, ...rest } = state;
      return {
        ...rest,
        status: 'success',
        result: action.result,
      };
    }

    case 'STRIP_ERROR': {
      const { result: _r, ...rest } = state;
      return {
        ...rest,
        status: 'error',
        errorCode: action.code,
        errorMessage: action.message,
      };
    }

    case 'RESET':
      return initialStripState;
  }
}

/**
 * 現在の strip state から StripOptions を構築する純粋関数。
 *
 * 判定ロジック:
 * - 全 7 カテゴリ選択 かつ keepIcc=false → remove: 'all'
 * - それ以外 → 選択カテゴリの配列 (keepIcc=false のとき icc を追加)
 *
 * NOTE: keepIcc=false のとき、selectedCategories に icc は含まれていないが
 * strip 時に icc も削除したい。全選択でない場合は icc を配列に追加して返す。
 */
export function buildStripOptions(state: StripState): {
  readonly remove: readonly StripCategory[] | 'all';
} {
  const allSelected =
    STRIP_CATEGORIES.length === state.selectedCategories.length &&
    STRIP_CATEGORIES.every((c) => state.selectedCategories.includes(c));

  // 全選択 かつ keepIcc=false → 'all' で一括削除
  if (allSelected && !state.keepIcc) {
    return { remove: 'all' };
  }

  // 設計判断: keepIcc=false は「ICC も削除する」というユーザー意思表示。
  // 部分選択時も icc を remove に含めることで keepIcc トグルの意図を一貫させる。
  // (immutable: spread で新規配列を構築)
  const needsIcc = !state.keepIcc && !state.selectedCategories.includes('icc');
  const categories: readonly StripCategory[] = needsIcc
    ? [...state.selectedCategories, 'icc']
    : [...state.selectedCategories];

  return { remove: categories };
}
