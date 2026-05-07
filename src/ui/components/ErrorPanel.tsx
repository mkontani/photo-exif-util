import { t } from '@/ui/i18n/t';
import { type ErrorSeverity, getErrorDisplay } from '@/utils/error-display';
/**
 * 構造化されたエラーパネル。
 * 旧来の「エラー: <内部メッセージ>」表示では原因が不明だったため、
 * code から得たタイトル / 原因 / 対処法 の 3 点を視覚的に区別して表示する。
 */
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-solid';
import { Show } from 'solid-js';

interface ErrorPanelProps {
  readonly code: string;
  /** 開発者向け詳細メッセージ (折りたたみで表示) */
  readonly detail?: string;
  /** 閉じる / リトライハンドラ (任意) */
  readonly onDismiss?: () => void;
}

/** severity に応じた配色トークン */
function severityClasses(severity: ErrorSeverity): { container: string; icon: string } {
  switch (severity) {
    case 'error':
      return {
        container: 'border-red-300 bg-red-50 text-red-900',
        icon: 'text-red-500',
      };
    case 'warning':
      return {
        container: 'border-amber-300 bg-amber-50 text-amber-900',
        icon: 'text-amber-500',
      };
    case 'info':
      return {
        container: 'border-blue-300 bg-blue-50 text-blue-900',
        icon: 'text-blue-500',
      };
  }
}

export function ErrorPanel(props: ErrorPanelProps) {
  const display = () => getErrorDisplay(props.code);
  const classes = () => severityClasses(display().severity);
  const Icon = () => {
    const sev = display().severity;
    if (sev === 'error') return AlertCircle;
    if (sev === 'warning') return AlertTriangle;
    return Info;
  };

  return (
    <div role="alert" class={`rounded-lg border px-3 py-3 text-sm ${classes().container}`}>
      <div class="flex items-start gap-2">
        {(() => {
          const IconComponent = Icon();
          return <IconComponent class={`mt-0.5 h-4 w-4 flex-shrink-0 ${classes().icon}`} />;
        })()}
        <div class="flex-1 space-y-1">
          <p class="font-semibold">{t(display().titleKey, undefined, props.code)}</p>
          <p class="text-xs opacity-90">{t(display().descriptionKey, undefined, '')}</p>
          <Show when={display().hintKey}>
            <p class="text-xs opacity-80">💡 {t(display().hintKey ?? '', undefined, '')}</p>
          </Show>
          <Show when={props.detail}>
            <details class="mt-1">
              <summary class="cursor-pointer text-xs opacity-70 hover:opacity-100">
                {t('errui_show_detail', undefined, '詳細を表示')}
              </summary>
              <pre class="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/5 p-2 text-[11px] opacity-80">
                {props.code}: {props.detail}
              </pre>
            </details>
          </Show>
        </div>
        <Show when={props.onDismiss}>
          <button
            type="button"
            onClick={() => props.onDismiss?.()}
            aria-label={t('errui_dismiss', undefined, '閉じる')}
            class={`flex-shrink-0 rounded p-0.5 hover:bg-black/10 ${classes().icon}`}
          >
            <X class="h-4 w-4" />
          </button>
        </Show>
      </div>
    </div>
  );
}
