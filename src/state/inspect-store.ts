/**
 * Side Panel の inspect ルートに対応する状態管理。
 * reducer は純粋関数として分離しテスト可能にしている。
 * Solid Store / createSignal から呼び出して使う。
 */
import type { ExifField, ExifSummary } from '@/core/exif/types';
import type { ImageSource } from '@/core/ingest/types';

/** inspect ルートの状態 */
export interface InspectState {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly source?: ImageSource;
  readonly blob?: Blob;
  readonly summary?: ExifSummary;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  /** EXIF 表示用フィルタ */
  readonly filter: {
    readonly query: string;
    readonly category: string | 'all';
  };
}

export const initialInspectState: InspectState = {
  status: 'idle',
  filter: { query: '', category: 'all' },
};

export type InspectAction =
  | { type: 'INGEST_START'; source: ImageSource }
  | { type: 'INGEST_SUCCESS'; blob: Blob; summary: ExifSummary; source: ImageSource }
  | { type: 'INGEST_ERROR'; code: string; message: string }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_CATEGORY'; category: string | 'all' }
  | { type: 'RESET' };

/**
 * 純粋な reducer。
 * 元の state を変更せず常に新しいオブジェクトを返す。
 */
export function inspectReducer(state: InspectState, action: InspectAction): InspectState {
  switch (action.type) {
    case 'INGEST_START': {
      // exactOptionalPropertyTypes のため、undefined を明示的にセットする代わりに
      // 必要なキーだけ含む新しいオブジェクトを構築する
      const { blob: _b, summary: _s, errorCode: _ec, errorMessage: _em, ...rest } = state;
      return {
        ...rest,
        status: 'loading',
        source: action.source,
      };
    }

    case 'INGEST_SUCCESS': {
      const { errorCode: _ec, errorMessage: _em, ...rest } = state;
      return {
        ...rest,
        status: 'success',
        blob: action.blob,
        summary: action.summary,
        source: action.source,
      };
    }

    case 'INGEST_ERROR': {
      const { blob: _b, summary: _s, ...rest } = state;
      return {
        ...rest,
        status: 'error',
        errorCode: action.code,
        errorMessage: action.message,
      };
    }

    case 'SET_QUERY':
      return {
        ...state,
        filter: { ...state.filter, query: action.query },
      };

    case 'SET_CATEGORY':
      return {
        ...state,
        filter: { ...state.filter, category: action.category },
      };

    case 'RESET':
      return initialInspectState;
  }
}

/**
 * EXIF フィールドを filter 条件で絞り込む純粋関数。
 * - query: key の case-insensitive contains 検索
 * - category: 'all' 以外ならそのカテゴリのみ
 */
export function filterFields(
  fields: ExifSummary['fields'],
  filter: InspectState['filter'],
): readonly ExifField[] {
  const lowerQuery = filter.query.toLowerCase();

  return fields.filter((field) => {
    // カテゴリ絞り込み
    if (filter.category !== 'all' && field.category !== filter.category) {
      return false;
    }
    // query 絞り込み (空文字なら全通過)
    if (lowerQuery !== '' && !field.key.toLowerCase().includes(lowerQuery)) {
      return false;
    }
    return true;
  });
}
