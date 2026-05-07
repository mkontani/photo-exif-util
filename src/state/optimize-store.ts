/**
 * Side Panel の optimize ルートに対応する状態管理。
 * reducer は純粋関数として定義し、Solid createSignal から呼び出す。
 */
import type { SnsApplyResult, SnsProfile } from '@/core/sns/types';

/** optimize ルートの状態 */
export interface OptimizeState {
  readonly status: 'idle' | 'running' | 'success' | 'error';
  /** 選択中の SNS プロファイル ID */
  readonly selectedProfileId: string;
  /** ユーザーが上書きした品質値 (0-100)。未指定ならプロファイルの defaultQuality を使用 */
  readonly customQuality?: number;
  readonly result?: SnsApplyResult;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export const initialOptimizeState: OptimizeState = {
  status: 'idle',
  // デフォルトは X (Twitter) Post プロファイル
  selectedProfileId: 'x-post',
};

export type OptimizeAction =
  | { type: 'SELECT_PROFILE'; profileId: string }
  | { type: 'SET_QUALITY'; quality: number }
  | { type: 'CLEAR_QUALITY' }
  | { type: 'OPTIMIZE_START' }
  | { type: 'OPTIMIZE_SUCCESS'; result: SnsApplyResult }
  | { type: 'OPTIMIZE_ERROR'; code: string; message: string }
  | { type: 'RESET' };

/**
 * 純粋な reducer。
 * 元の state を変更せず常に新しいオブジェクトを返す。
 */
export function optimizeReducer(state: OptimizeState, action: OptimizeAction): OptimizeState {
  switch (action.type) {
    case 'SELECT_PROFILE': {
      // プロファイル変更時は customQuality をクリアして新プロファイルのデフォルト品質を使う
      const { customQuality: _cq, ...rest } = state;
      return {
        ...rest,
        selectedProfileId: action.profileId,
      };
    }

    case 'SET_QUALITY':
      return {
        ...state,
        customQuality: action.quality,
      };

    case 'CLEAR_QUALITY': {
      const { customQuality: _cq, ...rest } = state;
      return { ...rest };
    }

    case 'OPTIMIZE_START': {
      // 実行開始時に前回結果とエラーをクリア
      const { result: _r, errorCode: _ec, errorMessage: _em, ...rest } = state;
      return {
        ...rest,
        status: 'running',
      };
    }

    case 'OPTIMIZE_SUCCESS': {
      const { errorCode: _ec, errorMessage: _em, ...rest } = state;
      return {
        ...rest,
        status: 'success',
        result: action.result,
      };
    }

    case 'OPTIMIZE_ERROR': {
      const { result: _r, ...rest } = state;
      return {
        ...rest,
        status: 'error',
        errorCode: action.code,
        errorMessage: action.message,
      };
    }

    case 'RESET':
      return initialOptimizeState;
  }
}

/**
 * 選択プロファイルと customQuality から実効的なプロファイルを算出する純粋関数。
 * customQuality が指定されていれば defaultQuality を上書きした新しい SnsProfile を返す。
 * 元の profile オブジェクトは変更しない (immutable)。
 */
export function effectiveProfile(state: OptimizeState, profile: SnsProfile): SnsProfile {
  // customQuality 未指定ならそのまま返す
  if (state.customQuality === undefined) {
    return profile;
  }

  // defaultQuality を上書きした新しいオブジェクトを返す
  return {
    ...profile,
    defaultQuality: state.customQuality,
  };
}
