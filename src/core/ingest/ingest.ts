import { MAX_BLOB_SIZE_BYTES } from '@/core/exif/parse';
import { validateFile } from './file-validator';
import { validateMagicBytes } from './magic-bytes';
import type { ImageSource, IngestError, IngestResult } from './types';
import { validateUrl } from './url-validator';

/** ingest パイプラインの外部依存 (DI で注入) */
export interface IngestDeps {
  /**
   * Background SW から URL を fetch する関数。
   * IngestError を reject できる。
   */
  fetchUrl: (url: string) => Promise<Blob>;
  /**
   * chrome.permissions.contains / request の抽象化。
   * 省略した場合は権限チェックをスキップする。
   */
  ensureHostPermission?: (url: string) => Promise<boolean>;
}

/** ingest 動作オプション */
export interface IngestOptions {
  /** http スキームの URL を許可するか (デフォルト false) */
  readonly allowHttp?: boolean;
}

/** ingest の入力型 */
type IngestInput =
  | {
      readonly source: { readonly kind: 'file' | 'drop'; readonly name: string };
      readonly file: Blob;
    }
  | { readonly source: { readonly kind: 'url'; readonly url: string } }
  | {
      readonly source: {
        readonly kind: 'context-menu';
        readonly pageUrl: string;
        readonly srcUrl: string;
      };
    };

/**
 * URL からの取り込みに共通するパイプライン:
 *   1. URL バリデーション (SSRF 対策)
 *   2. ホスト権限チェック (任意)
 *   3. fetch
 *   4. サイズチェック
 *   5. マジックバイト検証
 */
async function ingestFromUrl(
  url: string,
  source: ImageSource,
  deps: IngestDeps,
  options?: IngestOptions,
): Promise<IngestResult> {
  // URL バリデーション (SSRF 対策)
  // exactOptionalPropertyTypes のため、undefined の場合はプロパティ自体を省略する
  const urlValidatorOptions: import('./url-validator').UrlValidatorOptions =
    options?.allowHttp !== undefined ? { allowHttp: options.allowHttp } : {};
  const validation = validateUrl(url, urlValidatorOptions);
  if (!validation.ok) {
    const error: IngestError =
      validation.code === 'INVALID_URL'
        ? { code: 'INVALID_URL', message: `Invalid URL: ${validation.reason}` }
        : {
            code: 'BLOCKED_URL',
            message: `Blocked URL: ${validation.reason}`,
            reason: validation.reason,
          };
    return Promise.reject(error);
  }

  // ホスト権限チェック (ensureHostPermission が定義されている場合)
  if (deps.ensureHostPermission !== undefined) {
    const hasPermission = await deps.ensureHostPermission(url);
    if (!hasPermission) {
      const error: IngestError = {
        code: 'PERMISSION_DENIED',
        message: `Host permission denied for: ${url}`,
      };
      return Promise.reject(error);
    }
  }

  // fetch (FETCH_FAILED 等は fetchUrl 内で reject される)
  const blob = await deps.fetchUrl(url);

  // サイズ上限チェック (fetch 後の実サイズを確認)
  if (blob.size > MAX_BLOB_SIZE_BYTES) {
    const error: IngestError = {
      code: 'TOO_LARGE',
      message: `Fetched blob size ${blob.size} exceeds limit`,
      sizeBytes: blob.size,
    };
    return Promise.reject(error);
  }

  // マジックバイト検証
  const { detected, accepted } = await validateMagicBytes(blob);
  if (!accepted) {
    const error: IngestError = {
      code: 'INVALID_FORMAT',
      message: `Invalid image format: detected "${detected}"`,
      detected,
    };
    return Promise.reject(error);
  }

  return {
    blob,
    source,
    format: detected,
    sizeBytes: blob.size,
  };
}

/**
 * 画像を取り込む統一 API。
 * source 種別に応じてフローを分岐し、IngestResult を返す。
 * エラー時は IngestError を reject する。
 */
export async function ingest(
  input: IngestInput,
  deps: IngestDeps,
  options?: IngestOptions,
): Promise<IngestResult> {
  const { source } = input;

  // file / drop はローカル Blob をバリデーションして返す
  if (source.kind === 'file' || source.kind === 'drop') {
    const fileInput = input as {
      readonly source: { readonly kind: 'file' | 'drop'; readonly name: string };
      readonly file: Blob;
    };
    const validationResult = await validateFile(fileInput.file);
    if (!validationResult.ok) {
      // validateFile のエラーコードは IngestError のサブセット
      const error: IngestError =
        validationResult.code === 'TOO_LARGE'
          ? { code: 'TOO_LARGE', message: validationResult.message, sizeBytes: fileInput.file.size }
          : validationResult.code === 'EMPTY_INPUT'
            ? { code: 'EMPTY_INPUT', message: validationResult.message }
            : { code: 'INVALID_FORMAT', message: validationResult.message, detected: 'unknown' };
      return Promise.reject(error);
    }

    // フォーマットは validateFile が一度のマジックバイト読み込みで判定済み
    return {
      blob: validationResult.blob,
      source,
      format: validationResult.detected,
      sizeBytes: fileInput.file.size,
    };
  }

  // url / context-menu は URL からの取り込みパイプラインを使用
  if (source.kind === 'url') {
    return ingestFromUrl(source.url, source, deps, options);
  }

  if (source.kind === 'context-menu') {
    return ingestFromUrl(source.srcUrl, source, deps, options);
  }

  // TypeScript の網羅性チェック用 (到達不能)
  /* c8 ignore next */
  return Promise.reject({
    code: 'INVALID_URL',
    message: 'Unknown source kind',
  } satisfies IngestError);
}
