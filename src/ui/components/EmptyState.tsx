/**
 * 画像が未選択のときに表示するプレースホルダー。
 * DropZone の下に配置して操作を促す。
 */
import { t } from '@/ui/i18n/t';
import { ImageIcon } from 'lucide-solid';

export function EmptyState() {
  return (
    <div class="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
      <ImageIcon size={48} aria-hidden="true" />
      <p class="text-sm">{t('empty_state_title', undefined, '画像が選択されていません')}</p>
      <p class="text-xs text-gray-300">
        {t('empty_state_hint', undefined, '上のエリアから画像を取り込んでください')}
      </p>
    </div>
  );
}
