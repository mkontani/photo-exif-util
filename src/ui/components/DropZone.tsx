/**
 * ドラッグ&ドロップ + file picker + URL input を提供するコンポーネント。
 * ファイルの受け取り口として Side Panel の最上部に配置する。
 */
import { t } from '@/ui/i18n/t';
import { createSignal } from 'solid-js';

interface DropZoneProps {
  onFiles: (files: readonly File[]) => void;
  onUrl?: (url: string) => void;
  accept?: string;
  /** disabled 時はドロップ・選択不可 */
  disabled?: boolean;
}

export function DropZone(props: DropZoneProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  const [urlValue, setUrlValue] = createSignal('');

  let fileInputRef: HTMLInputElement | undefined;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!props.disabled) setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (props.disabled) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      props.onFiles(Array.from(files));
    }
  }

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      props.onFiles(Array.from(files));
    }
  }

  function handleClick() {
    if (!props.disabled) {
      fileInputRef?.click();
    }
  }

  function handleUrlKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const trimmed = urlValue().trim();
    if (trimmed === '') return;
    props.onUrl?.(trimmed);
  }

  return (
    <div class="flex flex-col gap-3">
      {/* ドロップエリア: button 要素で a11y を確保 */}
      <button
        type="button"
        aria-label={t('dropzone_aria_label', undefined, '画像をドロップまたはクリックして選択')}
        aria-disabled={props.disabled}
        class={`flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors ${
          isDragging()
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        } ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        // ブラウザ外へのドラッグアウトで dragleave が発火しないケースの保険
        onDragEnd={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        disabled={props.disabled}
      >
        <p class="text-gray-500">
          {t('dropzone_hint', undefined, '画像をドロップ または クリックして選択')}
        </p>
        <p class="mt-1 text-xs text-gray-400">
          {t('dropzone_formats', undefined, 'JPEG / PNG / WebP')}
        </p>
      </button>

      {/* 非表示の file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={props.accept ?? 'image/jpeg,image/png,image/webp'}
        multiple
        aria-hidden="true"
        tabIndex={-1}
        class="sr-only"
        onChange={handleFileChange}
        disabled={props.disabled}
      />

      {/* URL 入力 */}
      <div class="flex flex-col gap-1">
        <label for="dropzone-url-input" class="text-xs text-gray-500">
          {t('dropzone_url_label', undefined, 'URL から取り込む')}
        </label>
        <input
          id="dropzone-url-input"
          type="url"
          aria-label={t('dropzone_url_label', undefined, 'URL から画像を取り込む')}
          placeholder="https://example.com/photo.jpg"
          value={urlValue()}
          onInput={(e) => setUrlValue(e.currentTarget.value)}
          onKeyDown={handleUrlKeyDown}
          disabled={props.disabled}
          class="rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
}
