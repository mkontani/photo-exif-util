/**
 * SNS 最適化ルートのパネルコンポーネント。
 * プロファイル選択 → 品質調整 → 実行 → ダウンロードの UI を提供する。
 *
 * onApply を DI できるようにして、テスト時に実際の apply 処理を差し替え可能にする。
 * 本番では applySnsProfile + defaultSnsApplyDeps を使う。
 */
import { SNS_PROFILES, getProfileById } from '@/core/sns/profiles';
import type { SnsApplyResult } from '@/core/sns/types';
import { effectiveProfile, initialOptimizeState, optimizeReducer } from '@/state/optimize-store';
import { downloadBlob } from '@/utils/download';
import { safeFilename } from '@/utils/filename';
import { For, Show, createSignal } from 'solid-js';
import { QualitySlider } from './QualitySlider';

interface OptimizePanelProps {
  readonly blob: Blob;
  readonly onComplete?: (result: SnsApplyResult) => void;
  /** テスト時に差し替える DI: デフォルトは applySnsProfile + defaultSnsApplyDeps */
  readonly onApply?: (
    blob: Blob,
    profileId: string,
    quality: number | undefined,
  ) => Promise<SnsApplyResult>;
}

export function OptimizePanel(props: OptimizePanelProps) {
  const [state, setState] = createSignal(initialOptimizeState);

  function dispatch(action: Parameters<typeof optimizeReducer>[1]) {
    setState((s) => optimizeReducer(s, action));
  }

  async function handleOptimize() {
    dispatch({ type: 'OPTIMIZE_START' });

    const currentState = state();
    const profile = getProfileById(currentState.selectedProfileId);
    if (!profile) {
      dispatch({
        type: 'OPTIMIZE_ERROR',
        code: 'INVALID_PROFILE',
        message: `プロファイル "${currentState.selectedProfileId}" が見つかりません`,
      });
      return;
    }

    const effProfile = effectiveProfile(currentState, profile);

    try {
      let result: SnsApplyResult;
      if (props.onApply) {
        // DI mock を使う
        result = await props.onApply(props.blob, effProfile.id, currentState.customQuality);
      } else {
        // 本番: defaultSnsApplyDeps を使って実際に処理する
        // Side Panel コンテキストで OffscreenCanvas / pica が動作する
        const { applySnsProfile, defaultSnsApplyDeps } = await import('@/core/sns/apply');
        result = await applySnsProfile(props.blob, effProfile, defaultSnsApplyDeps);
      }
      dispatch({ type: 'OPTIMIZE_SUCCESS', result });
      props.onComplete?.(result);
    } catch (err: unknown) {
      const errObj = err as Partial<{ code: string; message: string }>;
      dispatch({
        type: 'OPTIMIZE_ERROR',
        code: errObj.code ?? 'OPTIMIZE_ERROR',
        message: errObj.message ?? '最適化処理に失敗しました',
      });
    }
  }

  function handleDownload() {
    const result = state().result;
    if (!result) return;
    const ext = result.outputFormat === 'jpeg' ? '.jpg' : `.${result.outputFormat}`;
    const filename = safeFilename(`optimized-${result.profileId}${ext}`);
    downloadBlob(result.blob, filename);
  }

  const isRunning = () => state().status === 'running';

  /** 現在選択中のプロファイルの defaultQuality (カスタム品質の初期値に使う) */
  const currentDefaultQuality = () => {
    const profile = getProfileById(state().selectedProfileId);
    return profile?.defaultQuality ?? 85;
  };

  const displayQuality = () => state().customQuality ?? currentDefaultQuality();

  return (
    <div class="flex flex-col gap-4">
      {/* プロファイル選択 */}
      <div class="flex flex-col gap-1">
        <label for="optimize-profile-select" class="text-sm font-medium">
          SNS プロファイル
        </label>
        <select
          id="optimize-profile-select"
          value={state().selectedProfileId}
          onChange={(e) => dispatch({ type: 'SELECT_PROFILE', profileId: e.currentTarget.value })}
          class="rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <For each={SNS_PROFILES}>
            {(profile) => <option value={profile.id}>{profile.label}</option>}
          </For>
        </select>
      </div>

      {/* 品質スライダー */}
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">品質</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLEAR_QUALITY' })}
            class="text-xs text-gray-400 underline hover:text-gray-600"
          >
            リセット
          </button>
        </div>
        <QualitySlider
          value={displayQuality()}
          onChange={(v) => dispatch({ type: 'SET_QUALITY', quality: v })}
        />
      </div>

      {/* 実行ボタン */}
      <button
        type="button"
        onClick={handleOptimize}
        disabled={isRunning()}
        class="rounded bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Show when={isRunning()} fallback="最適化して書き出し">
          最適化中...
        </Show>
      </button>

      {/* エラー表示 */}
      <Show when={state().status === 'error'}>
        <div
          class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          <strong>エラー:</strong> {state().errorMessage}
        </div>
      </Show>

      {/* 成功: 結果表示 + ダウンロード */}
      {/* Show の accessor パターンで result の non-null を型安全に扱う */}
      <Show when={state().status === 'success' ? state().result : undefined}>
        {(result) => (
          <div class="flex flex-col gap-2">
            <div class="rounded border bg-gray-50 px-3 py-2 text-sm">
              <div class="grid grid-cols-2 gap-1 text-gray-600">
                <span>寸法:</span>
                <span>
                  {result().outputDimensions.width} × {result().outputDimensions.height}
                </span>
                <span>サイズ:</span>
                <span>{(result().outputSizeBytes / 1024).toFixed(1)} KB</span>
                <span>品質:</span>
                <span>{result().quality}</span>
                <span>フォーマット:</span>
                <span>{result().outputFormat.toUpperCase()}</span>
                <Show when={!result().sizeTargetReached}>
                  <span class="col-span-2 text-orange-600">目標サイズに収まりませんでした</span>
                </Show>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              class="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              ダウンロード
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}
