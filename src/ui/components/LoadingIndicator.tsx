import { t } from '@/ui/i18n/t';
/**
 * 処理中のフェーズを伝えるローディングインジケータ。
 * lucide-solid の Loader2 を回転させ、フェーズ別 i18n キーで現在の作業を伝える。
 */
import { Loader2 } from 'lucide-solid';

interface LoadingIndicatorProps {
  /** 現在の処理フェーズ */
  readonly phase: 'fetching' | 'validating' | 'parsing';
}

const PHASE_KEY: Record<LoadingIndicatorProps['phase'], string> = {
  fetching: 'loading_phase_fetching',
  validating: 'loading_phase_validating',
  parsing: 'loading_phase_parsing',
};

const PHASE_FALLBACK: Record<LoadingIndicatorProps['phase'], string> = {
  fetching: '画像を取得中…',
  validating: '画像を検証中…',
  parsing: 'EXIF を読み取り中…',
};

export function LoadingIndicator(props: LoadingIndicatorProps) {
  return (
    <output class="flex items-center justify-center gap-2 py-6 text-sm text-gray-600">
      <Loader2 class="h-4 w-4 animate-spin text-blue-500" aria-hidden="true" />
      <span>{t(PHASE_KEY[props.phase], undefined, PHASE_FALLBACK[props.phase])}</span>
    </output>
  );
}
