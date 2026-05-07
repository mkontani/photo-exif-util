import type { ImageFormat } from '@/core/exif/types';

/** 取得元の種別 */
export type ImageSourceKind = 'file' | 'drop' | 'url' | 'context-menu' | 'clipboard';

/** 取得元の詳細情報 */
export type ImageSource =
  | { readonly kind: 'file'; readonly name: string }
  | { readonly kind: 'drop'; readonly name: string }
  | { readonly kind: 'url'; readonly url: string }
  | {
      readonly kind: 'context-menu';
      readonly pageUrl: string;
      readonly srcUrl: string;
    }
  | { readonly kind: 'clipboard' };

/** ingest 成功時の結果 */
export interface IngestResult {
  readonly blob: Blob;
  readonly source: ImageSource;
  readonly format: ImageFormat;
  readonly sizeBytes: number;
}

/**
 * ingest 失敗時のエラー型。
 * rejected Promise の値として使用する。
 */
export type IngestError =
  | { readonly code: 'INVALID_URL'; readonly message: string }
  | {
      readonly code: 'BLOCKED_URL';
      readonly message: string;
      readonly reason: string;
    }
  | {
      readonly code: 'FETCH_FAILED';
      readonly message: string;
      readonly status?: number;
    }
  | { readonly code: 'TOO_LARGE'; readonly message: string; readonly sizeBytes: number }
  | { readonly code: 'EMPTY_INPUT'; readonly message: string }
  | {
      readonly code: 'INVALID_FORMAT';
      readonly message: string;
      readonly detected: ImageFormat;
    }
  | { readonly code: 'PERMISSION_DENIED'; readonly message: string }
  | { readonly code: 'CORS_BLOCKED'; readonly message: string };
