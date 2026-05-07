import { MAX_BLOB_SIZE_BYTES } from '@/core/exif/parse';
import type { IngestError } from '@/core/ingest/types';
import { validateUrl } from '@/core/ingest/url-validator';

/**
 * Background Service Worker から URL を fetch して Blob を返す。
 * SSRF 対策バリデーションと Content-Length / 実サイズの両方をチェックする。
 *
 * リダイレクト方針: `redirect: 'manual'` でブラウザに自動追跡させない。
 * `https://public.example/img.jpg` → `http://192.168.1.1/img.jpg` のような
 * SSRF バイパスを防ぐため、3xx レスポンスは opaqueredirect として `FETCH_FAILED`
 * に変換する (UI で「リダイレクトは許可されていません」と表示する想定)。
 *
 * Phase 7+ で必要なら chrome.webRequest を使ってリダイレクト先を取得し、
 * 再度 validateUrl を通すフローを実装する。
 *
 * ブラウザ API に依存するため coverage exclude 対象。Phase 7 で integration test を行う。
 *
 * @throws {IngestError} BLOCKED_URL / INVALID_URL / FETCH_FAILED / TOO_LARGE
 */
export async function fetchImageUrl(url: string, allowHttp = false): Promise<Blob> {
  const validation = validateUrl(url, { allowHttp });
  if (!validation.ok) {
    const error: IngestError =
      validation.code === 'INVALID_URL'
        ? { code: 'INVALID_URL', message: `Invalid URL: ${validation.reason}` }
        : {
            code: 'BLOCKED_URL',
            message: `URL blocked: ${validation.reason}`,
            reason: validation.reason,
          };
    throw error;
  }

  const response = await fetch(validation.url.toString(), {
    method: 'GET',
    redirect: 'manual',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  }).catch((cause: unknown) => {
    const error: IngestError = {
      code: 'FETCH_FAILED',
      message: cause instanceof Error ? cause.message : 'Network error',
    };
    throw error;
  });

  if (response.type === 'opaqueredirect') {
    const error: IngestError = {
      code: 'FETCH_FAILED',
      message: 'Redirect not allowed (SSRF 対策のため自動追跡を無効化)',
    };
    throw error;
  }

  return processResponse(response);
}

async function processResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    const error: IngestError = {
      code: 'FETCH_FAILED',
      message: `HTTP ${response.status}`,
      status: response.status,
    };
    throw error;
  }

  // Content-Length ヘッダーで事前チェック (転送前に巨大ファイルを弾く)
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BLOB_SIZE_BYTES) {
    const error: IngestError = {
      code: 'TOO_LARGE',
      message: 'Content-Length exceeds limit',
      sizeBytes: contentLength,
    };
    throw error;
  }

  const blob = await response.blob();

  // 実際に受信したサイズも確認 (Content-Length が省略されていた場合)
  if (blob.size > MAX_BLOB_SIZE_BYTES) {
    const error: IngestError = {
      code: 'TOO_LARGE',
      message: 'Actual size exceeds limit',
      sizeBytes: blob.size,
    };
    throw error;
  }

  return blob;
}
