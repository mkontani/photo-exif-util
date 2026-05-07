import {
  ingestRequestSchema,
  ingestResponseSchema,
  isExtensionSender,
  messageSchema,
  openPanelSchema,
} from '@/messaging/protocol';
import { describe, expect, it } from 'vitest';

describe('ingestRequestSchema', () => {
  it('kind=url の有効なペイロードを parse できる', () => {
    const payload = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url: 'https://example.com/image.jpg' },
    };
    expect(() => ingestRequestSchema.parse(payload)).not.toThrow();
  });

  it('kind=context-menu の有効なペイロードを parse できる', () => {
    const payload = {
      type: 'INGEST_REQUEST',
      payload: {
        kind: 'context-menu',
        pageUrl: 'https://example.com/',
        srcUrl: 'https://example.com/image.jpg',
      },
    };
    expect(() => ingestRequestSchema.parse(payload)).not.toThrow();
  });

  it('不正な type は reject される', () => {
    const payload = {
      type: 'WRONG_TYPE',
      payload: { kind: 'url', url: 'https://example.com/image.jpg' },
    };
    expect(() => ingestRequestSchema.parse(payload)).toThrow();
  });

  it('url が有効な URL でない場合は reject される', () => {
    const payload = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url: 'not-a-url' },
    };
    expect(() => ingestRequestSchema.parse(payload)).toThrow();
  });

  it('payload が undefined の場合は reject される', () => {
    const payload = { type: 'INGEST_REQUEST' };
    expect(() => ingestRequestSchema.parse(payload)).toThrow();
  });

  it('parse 結果の型が正しい', () => {
    const raw = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url: 'https://example.com/img.jpg' },
    };
    const parsed = ingestRequestSchema.parse(raw);
    expect(parsed.type).toBe('INGEST_REQUEST');
    expect(parsed.payload.kind).toBe('url');
  });

  it('javascript: URL は refine で reject される', () => {
    const raw = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url: 'javascript:alert(1)' },
    };
    expect(() => ingestRequestSchema.parse(raw)).toThrow();
  });

  it('data: URL も http/https 限定 refine で reject される', () => {
    const raw = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url: 'data:text/plain;base64,SGk=' },
    };
    expect(() => ingestRequestSchema.parse(raw)).toThrow();
  });

  it('file:// URL は refine で reject される', () => {
    const raw = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'context-menu', pageUrl: 'https://x.com', srcUrl: 'file:///etc/passwd' },
    };
    expect(() => ingestRequestSchema.parse(raw)).toThrow();
  });
});

describe('ingestResponseSchema', () => {
  it('ok=true の有効なレスポンスを parse できる', () => {
    const payload = { type: 'INGEST_RESPONSE', ok: true };
    expect(() => ingestResponseSchema.parse(payload)).not.toThrow();
  });

  it('ok=false の有効なレスポンスを parse できる', () => {
    const payload = { type: 'INGEST_RESPONSE', ok: false };
    expect(() => ingestResponseSchema.parse(payload)).not.toThrow();
  });

  it('ok が boolean でない場合は reject される', () => {
    const payload = { type: 'INGEST_RESPONSE', ok: 'yes' };
    expect(() => ingestResponseSchema.parse(payload)).toThrow();
  });

  it('type が INGEST_RESPONSE でない場合は reject される', () => {
    const payload = { type: 'INGEST_REQUEST', ok: true };
    expect(() => ingestResponseSchema.parse(payload)).toThrow();
  });

  // Phase 6: payload フィールドのテスト
  it('ok=true + payload あり → parse できる', () => {
    const payload = {
      type: 'INGEST_RESPONSE',
      ok: true,
      payload: {
        dataBase64: 'aGVsbG8=',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
      },
    };
    expect(() => ingestResponseSchema.parse(payload)).not.toThrow();
  });

  it('ok=true + payload なし → parse できる (optional)', () => {
    const payload = { type: 'INGEST_RESPONSE', ok: true };
    const result = ingestResponseSchema.parse(payload);
    expect(result.payload).toBeUndefined();
  });

  it('payload.sizeBytes が負の数 → reject される', () => {
    const payload = {
      type: 'INGEST_RESPONSE',
      ok: true,
      payload: {
        dataBase64: 'aGVsbG8=',
        mimeType: 'image/jpeg',
        sizeBytes: -1,
      },
    };
    expect(() => ingestResponseSchema.parse(payload)).toThrow();
  });

  it('payload.sizeBytes が非整数 → reject される', () => {
    const payload = {
      type: 'INGEST_RESPONSE',
      ok: true,
      payload: {
        dataBase64: 'aGVsbG8=',
        mimeType: 'image/jpeg',
        sizeBytes: 1.5,
      },
    };
    expect(() => ingestResponseSchema.parse(payload)).toThrow();
  });

  it('ok=false + error オブジェクト → parse できる', () => {
    const payload = {
      type: 'INGEST_RESPONSE',
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'HTTP 404' },
    };
    expect(() => ingestResponseSchema.parse(payload)).not.toThrow();
  });

  it('ok=false + error.code/message → 取得できる', () => {
    const payload = {
      type: 'INGEST_RESPONSE',
      ok: false,
      error: { code: 'TOO_LARGE', message: 'size exceeded' },
    };
    const result = ingestResponseSchema.parse(payload);
    expect(result.error?.code).toBe('TOO_LARGE');
    expect(result.error?.message).toBe('size exceeded');
  });
});

describe('openPanelSchema', () => {
  it('有効な OPEN_PANEL メッセージを parse できる', () => {
    const payload = {
      type: 'OPEN_PANEL',
      payload: {
        srcUrl: 'https://example.com/image.jpg',
        pageUrl: 'https://example.com/',
      },
    };
    expect(() => openPanelSchema.parse(payload)).not.toThrow();
  });

  it('srcUrl が URL 形式でない場合は reject される', () => {
    const payload = {
      type: 'OPEN_PANEL',
      payload: { srcUrl: 'not-a-url', pageUrl: 'https://example.com/' },
    };
    expect(() => openPanelSchema.parse(payload)).toThrow();
  });

  it('pageUrl が URL 形式でない場合は reject される', () => {
    const payload = {
      type: 'OPEN_PANEL',
      payload: { srcUrl: 'https://example.com/img.jpg', pageUrl: 'not-a-url' },
    };
    expect(() => openPanelSchema.parse(payload)).toThrow();
  });

  it('type が OPEN_PANEL でない場合は reject される', () => {
    const payload = {
      type: 'WRONG',
      payload: { srcUrl: 'https://example.com/img.jpg', pageUrl: 'https://example.com/' },
    };
    expect(() => openPanelSchema.parse(payload)).toThrow();
  });
});

describe('messageSchema (discriminatedUnion)', () => {
  it('INGEST_REQUEST を正しく識別して parse する', () => {
    const msg = {
      type: 'INGEST_REQUEST',
      payload: { kind: 'url', url: 'https://example.com/img.jpg' },
    };
    const parsed = messageSchema.parse(msg);
    expect(parsed.type).toBe('INGEST_REQUEST');
  });

  it('INGEST_RESPONSE を正しく識別して parse する', () => {
    const msg = { type: 'INGEST_RESPONSE', ok: true };
    const parsed = messageSchema.parse(msg);
    expect(parsed.type).toBe('INGEST_RESPONSE');
  });

  it('OPEN_PANEL を正しく識別して parse する', () => {
    const msg = {
      type: 'OPEN_PANEL',
      payload: { srcUrl: 'https://cdn.example.com/img.jpg', pageUrl: 'https://example.com/' },
    };
    const parsed = messageSchema.parse(msg);
    expect(parsed.type).toBe('OPEN_PANEL');
  });

  it('未知の type は reject される', () => {
    const msg = { type: 'UNKNOWN_MESSAGE', data: 'something' };
    expect(() => messageSchema.parse(msg)).toThrow();
  });

  it('type フィールドが欠如している場合は reject される', () => {
    const msg = { payload: { kind: 'url', url: 'https://example.com/img.jpg' } };
    expect(() => messageSchema.parse(msg)).toThrow();
  });

  it('context-menu kind の INGEST_REQUEST を parse できる', () => {
    const msg = {
      type: 'INGEST_REQUEST',
      payload: {
        kind: 'context-menu',
        pageUrl: 'https://example.com/',
        srcUrl: 'https://cdn.example.com/img.jpg',
      },
    };
    const parsed = messageSchema.parse(msg);
    expect(parsed.type).toBe('INGEST_REQUEST');
  });
});

describe('isExtensionSender', () => {
  it('sender ID が expected ID と一致する場合 true', () => {
    expect(isExtensionSender('ext-id-abc123', 'ext-id-abc123')).toBe(true);
  });

  it('sender ID が expected ID と一致しない場合 false', () => {
    expect(isExtensionSender('wrong-id', 'ext-id-abc123')).toBe(false);
  });

  it('sender ID が undefined の場合 false', () => {
    expect(isExtensionSender(undefined, 'ext-id-abc123')).toBe(false);
  });

  it('空文字 sender ID は false', () => {
    expect(isExtensionSender('', 'ext-id-abc123')).toBe(false);
  });

  it('両方とも空文字の場合 true (同一視)', () => {
    expect(isExtensionSender('', '')).toBe(true);
  });
});
