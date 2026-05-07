import { parseExif } from '@/core/exif/parse';
import type { ExifSummary } from '@/core/exif/types';
import { validateFile } from '@/core/ingest/file-validator';
import { validateUrl } from '@/core/ingest/url-validator';
import { chromeRuntimeSender, requestIngestUrl } from '@/messaging/bridge';
import { initialInspectState, inspectReducer } from '@/state/inspect-store';
import type { InspectState } from '@/state/inspect-store';
import { DropZone } from '@/ui/components/DropZone';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorPanel } from '@/ui/components/ErrorPanel';
import { ExifTable } from '@/ui/components/ExifTable';
import { ImageSummary } from '@/ui/components/ImageSummary';
import { LoadingIndicator } from '@/ui/components/LoadingIndicator';
import { OptimizePanel } from '@/ui/components/OptimizePanel';
import { StripPanel } from '@/ui/components/StripPanel';
import { Tabs } from '@/ui/components/Tabs';
import { t } from '@/ui/i18n/t';
import { extractErrorInfo } from '@/utils/error';
/**
 * Side Panel のメインアプリコンポーネント。
 * Phase 6: URL ingest を Background SW 経由に変更。extractErrorInfo でエラー処理を統一。
 *
 * 状態管理は inspectReducer を createSignal + dispatch パターンで運用している。
 * タブ切替は createSignal<TabId> で管理し、inspect 完了後に strip/optimize が活性化する。
 */
import { RotateCcw } from 'lucide-solid';
import { Show, createSignal, onCleanup, onMount } from 'solid-js';

type TabId = 'inspect' | 'strip' | 'optimize';

/** chrome.storage.session に書き込まれる pending ingest の形式 */
interface PendingIngest {
  readonly srcUrl: string;
  readonly ts: number;
}

/** ローディングフェーズ識別子 (LoadingIndicator が i18n キーに変換する) */
type LoadingPhase = 'fetching' | 'validating' | 'parsing';

export function App() {
  const [state, setState] = createSignal<InspectState>(initialInspectState);
  const [activeTab, setActiveTab] = createSignal<TabId>('inspect');
  const [loadingPhase, setLoadingPhase] = createSignal<LoadingPhase>('validating');

  function dispatch(action: Parameters<typeof inspectReducer>[1]) {
    setState((s) => inspectReducer(s, action));
  }

  /** File / Blob を受け取って EXIF を解析する共通処理 */
  async function processBlob(blob: Blob, sourceName: string) {
    setLoadingPhase('validating');
    const validation = await validateFile(blob);
    if (!validation.ok) {
      dispatch({ type: 'INGEST_ERROR', code: validation.code, message: validation.message });
      return;
    }

    let summary: ExifSummary;
    try {
      setLoadingPhase('parsing');
      summary = await parseExif(validation.blob);
    } catch (err: unknown) {
      // parseExif は ExifParseError を reject。extractErrorInfo で安全に展開
      const { code, message } = extractErrorInfo(err, 'PARSE_ERROR');
      dispatch({ type: 'INGEST_ERROR', code, message });
      return;
    }

    dispatch({
      type: 'INGEST_SUCCESS',
      blob: validation.blob,
      summary,
      source: { kind: 'file', name: sourceName },
    });
  }

  async function handleFiles(files: readonly File[]) {
    const file = files[0];
    if (!file) return;

    dispatch({ type: 'INGEST_START', source: { kind: 'file', name: file.name } });
    await processBlob(file, file.name);
  }

  async function handleUrl(url: string) {
    // ユーザー入力 URL は data:/blob: を許さない (拡張内部生成 URL のみがそれらを使う)。
    // 巨大 base64 入力による DoS、および blob: の他オリジン参照を防ぐ。
    const validation = validateUrl(url, { allowData: false, allowBlob: false });
    if (!validation.ok) {
      dispatch({ type: 'INGEST_ERROR', code: validation.code, message: validation.reason });
      return;
    }

    dispatch({ type: 'INGEST_START', source: { kind: 'url', url } });
    setLoadingPhase('fetching');

    // Phase 6: Background SW 経由で URL fetch する (SSRF 対策のため直接 fetch しない)
    try {
      const blob = await requestIngestUrl(url, chromeRuntimeSender);
      const sourceName = new URL(url).pathname.split('/').pop() ?? 'image';
      await processBlob(blob, sourceName);
    } catch (err: unknown) {
      const { code, message } = extractErrorInfo(err, 'FETCH_FAILED');
      dispatch({ type: 'INGEST_ERROR', code, message });
    }
  }

  function handleReset() {
    dispatch({ type: 'RESET' });
    setActiveTab('inspect');
  }

  const isLoading = () => state().status === 'loading';
  const isSuccess = () => state().status === 'success';

  // summary を安全に取り出すヘルパ (non-null assertion を避けるため)
  const summary = () => state().summary;
  const blob = () => state().blob;

  // inspect 完了後のみ strip/optimize タブを活性化できる
  function handleTabChange(id: string) {
    const tabId = id as TabId;
    // strip/optimize は inspect 完了後のみ許可
    if ((tabId === 'strip' || tabId === 'optimize') && !isSuccess()) return;
    setActiveTab(tabId);
  }

  /**
   * 右クリック「Photo EXIF Util で開く」経由の pending ingest を取得して処理する。
   * Background SW が chrome.storage.session.set({ pendingIngest }) で渡してくる。
   */
  async function consumePendingIngest(value: unknown): Promise<void> {
    if (
      value === null ||
      typeof value !== 'object' ||
      !('srcUrl' in value) ||
      typeof (value as PendingIngest).srcUrl !== 'string'
    ) {
      return;
    }
    const srcUrl = (value as PendingIngest).srcUrl;
    // 一度処理したら storage から消す (リロードでの二重起動防止)
    try {
      await chrome.storage.session.remove('pendingIngest');
    } catch {
      // 失敗しても処理は続行する
    }
    await handleUrl(srcUrl);
  }

  onMount(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return;

    // 起動時の pending チェック (sidePanel.open より前に context-menu が書き込んだケース)
    chrome.storage.session
      .get('pendingIngest')
      .then((result) => consumePendingIngest(result.pendingIngest))
      .catch(() => {
        /* storage 取得失敗時は無視 */
      });

    // Side Panel が既に開いている状態で context-menu がクリックされた場合に受信
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'session') return;
      if (changes.pendingIngest?.newValue === undefined) return;
      consumePendingIngest(changes.pendingIngest.newValue);
    };
    chrome.storage.onChanged.addListener(onChanged);
    onCleanup(() => chrome.storage.onChanged.removeListener(onChanged));
  });

  return (
    <div class="flex h-screen flex-col">
      {/* ヘッダー */}
      <header class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div class="flex items-center gap-2">
          <img src="/icons/icon-32.png" alt="" class="h-5 w-5" aria-hidden="true" />
          <h1 class="text-base font-bold">Photo EXIF Util</h1>
        </div>
        <Show when={state().status !== 'idle'}>
          <button
            type="button"
            onClick={handleReset}
            class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('app_reset', undefined, 'リセット')}
          >
            <RotateCcw class="h-3 w-3" aria-hidden="true" />
            {t('app_reset', undefined, 'リセット')}
          </button>
        </Show>
      </header>

      {/* タブ切替: inspect 完了するまで strip/optimize は disabled */}
      <Tabs
        tabs={[
          { id: 'inspect', label: t('tab_inspect', undefined, '検査') },
          { id: 'strip', label: t('tab_strip', undefined, '削除'), disabled: !isSuccess() },
          { id: 'optimize', label: t('tab_optimize', undefined, '最適化'), disabled: !isSuccess() },
        ]}
        active={activeTab()}
        onChange={handleTabChange}
      />

      <main class="flex flex-1 flex-col gap-4 overflow-auto p-4">
        {/* inspect タブ */}
        <Show when={activeTab() === 'inspect'}>
          {/* DropZone: 常に表示 */}
          <DropZone onFiles={handleFiles} onUrl={handleUrl} disabled={isLoading()} />

          {/* ローディング: スピナー + フェーズ */}
          <Show when={isLoading()}>
            <LoadingIndicator phase={loadingPhase()} />
          </Show>

          {/* エラーバナー: 構造化された ErrorPanel */}
          <Show when={state().status === 'error'}>
            {(() => {
              const detail = state().errorMessage;
              return (
                <ErrorPanel
                  code={state().errorCode ?? 'UNKNOWN'}
                  {...(detail !== undefined ? { detail } : {})}
                  onDismiss={handleReset}
                />
              );
            })()}
          </Show>

          {/* 成功: 画像サマリ + EXIF 表示 */}
          <Show when={isSuccess() && summary() !== undefined && blob() !== undefined}>
            {(_) => {
              const s = summary() as ExifSummary;
              const b = blob() as Blob;
              const src = state().source;
              const sourceName =
                src?.kind === 'file' || src?.kind === 'drop' ? src.name : undefined;
              return (
                <div class="flex flex-col gap-3">
                  {sourceName !== undefined ? (
                    <ImageSummary blob={b} summary={s} sourceName={sourceName} />
                  ) : (
                    <ImageSummary blob={b} summary={s} />
                  )}
                  <ExifTable summary={s} />
                </div>
              );
            }}
          </Show>

          {/* 初期状態: EmptyState */}
          <Show when={state().status === 'idle'}>
            <EmptyState />
          </Show>
        </Show>

        {/* strip タブ: inspect 完了後のみ表示 */}
        <Show when={activeTab() === 'strip'}>
          <Show
            when={isSuccess() && blob() !== undefined && summary() !== undefined}
            fallback={
              <div class="py-8 text-center text-sm text-gray-400">
                {t('app_load_image_first', undefined, 'まず「検査」タブで画像を読み込んでください')}
              </div>
            }
          >
            {(_) => <StripPanel blob={blob() as Blob} summary={summary() as ExifSummary} />}
          </Show>
        </Show>

        {/* optimize タブ: inspect 完了後のみ表示 */}
        <Show when={activeTab() === 'optimize'}>
          <Show
            when={isSuccess() && blob() !== undefined}
            fallback={
              <div class="py-8 text-center text-sm text-gray-400">
                {t('app_load_image_first', undefined, 'まず「検査」タブで画像を読み込んでください')}
              </div>
            }
          >
            {(_) => <OptimizePanel blob={blob() as Blob} />}
          </Show>
        </Show>
      </main>
    </div>
  );
}
