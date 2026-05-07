import type { MessageSender } from '@/messaging/bridge';
import { requestIngestUrl } from '@/messaging/bridge';
import { describe, expect, it, vi } from 'vitest';

describe('requestIngestUrl', () => {
  it('INGEST_REQUEST メッセージが sender.send で送信される', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      type: 'INGEST_RESPONSE',
      ok: true,
      payload: {
        dataBase64: 'aGVsbG8=',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
      },
    });
    const mockSender: MessageSender = { send: mockSend };

    await requestIngestUrl('https://example.com/img.jpg', mockSender);

    expect(mockSend).toHaveBeenCalledOnce();
    const sentMessage = mockSend.mock.calls[0]?.[0];
    expect(sentMessage).toMatchObject({
      type: 'INGEST_REQUEST',
      payload: {
        kind: 'url',
        url: 'https://example.com/img.jpg',
      },
    });
  });

  it('ok=true + payload あり → Blob を返す', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue({
        type: 'INGEST_RESPONSE',
        ok: true,
        payload: {
          dataBase64: 'aGVsbG8=',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
        },
      }),
    };

    const result = await requestIngestUrl('https://example.com/img.jpg', mockSender);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBe(5);
  });

  it('ok=true + payload の Blob 内容が dataBase64 と一致する', async () => {
    // "hello" = aGVsbG8=
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue({
        type: 'INGEST_RESPONSE',
        ok: true,
        payload: {
          dataBase64: 'aGVsbG8=',
          mimeType: 'image/png',
          sizeBytes: 5,
        },
      }),
    };

    const result = await requestIngestUrl('https://example.com/img.png', mockSender);
    const text = await result.text();
    expect(text).toBe('hello');
  });

  it('ok=false + error オブジェクト → BridgeError (BRIDGE_ERROR)', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue({
        type: 'INGEST_RESPONSE',
        ok: false,
        error: { code: 'FETCH_FAILED', message: 'HTTP 404' },
      }),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'BRIDGE_ERROR',
        message: expect.stringContaining('HTTP 404'),
      },
    );
  });

  it('ok=false + error なし → BridgeError (BRIDGE_ERROR)', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue({
        type: 'INGEST_RESPONSE',
        ok: false,
      }),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'BRIDGE_ERROR',
      },
    );
  });

  it('ok=true だが payload なし → INVALID_RESPONSE', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue({
        type: 'INGEST_RESPONSE',
        ok: true,
        // payload なし
      }),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'INVALID_RESPONSE',
      },
    );
  });

  it('不正なレスポンスフォーマットで INVALID_RESPONSE が throw される', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue({ unexpected: 'format' }),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'INVALID_RESPONSE',
      },
    );
  });

  it('null レスポンスで INVALID_RESPONSE が throw される', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockResolvedValue(null),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'INVALID_RESPONSE',
      },
    );
  });

  it('sender が throw したとき BRIDGE_ERROR が throw される', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockRejectedValue(new Error('connection failed')),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'BRIDGE_ERROR',
        message: expect.stringContaining('connection failed'),
      },
    );
  });

  it('sender が非 Error を throw したときも BRIDGE_ERROR になる', async () => {
    const mockSender: MessageSender = {
      send: vi.fn().mockRejectedValue('string error'),
    };

    await expect(requestIngestUrl('https://example.com/img.jpg', mockSender)).rejects.toMatchObject(
      {
        code: 'BRIDGE_ERROR',
      },
    );
  });
});
