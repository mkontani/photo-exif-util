import { isPrivateOrLoopbackHost, validateUrl } from '@/core/ingest/url-validator';
import { describe, expect, it } from 'vitest';

describe('validateUrl', () => {
  describe('正常系 (ok=true)', () => {
    it('https スキームは許可される', () => {
      const result = validateUrl('https://example.com/image.jpg');
      expect(result.ok).toBe(true);
    });

    it('ok=true 時に URL オブジェクトを返す', () => {
      const result = validateUrl('https://example.com/image.jpg');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.url).toBeInstanceOf(URL);
        expect(result.url.hostname).toBe('example.com');
      }
    });

    it('allowHttp=true の場合 http スキームは許可される', () => {
      const result = validateUrl('http://example.com', { allowHttp: true });
      expect(result.ok).toBe(true);
    });

    it('data: URL はデフォルトで許可される', () => {
      const result = validateUrl('data:image/png;base64,iVBORw0KGgo=');
      expect(result.ok).toBe(true);
    });

    it('blob: URL はデフォルトで許可される', () => {
      const result = validateUrl('blob:chrome-extension://abc/some-uuid');
      expect(result.ok).toBe(true);
    });

    it('allowData=false の場合 data: URL は拒否される', () => {
      const result = validateUrl('data:image/png;base64,abc', { allowData: false });
      expect(result.ok).toBe(false);
    });

    it('allowBlob=false の場合 blob: URL は拒否される', () => {
      const result = validateUrl('blob:chrome-extension://abc/uuid', { allowBlob: false });
      expect(result.ok).toBe(false);
    });

    it('172.32.0.1 は Private IP 範囲外なので許可される', () => {
      const result = validateUrl('https://172.32.0.1');
      expect(result.ok).toBe(true);
    });

    it('192.169.0.1 は Private IP 範囲外なので許可される', () => {
      const result = validateUrl('https://192.169.0.1');
      expect(result.ok).toBe(true);
    });

    it('パスやクエリが付いた https URL も許可される', () => {
      const result = validateUrl('https://cdn.example.com/path/to/image.jpg?v=1');
      expect(result.ok).toBe(true);
    });
  });

  describe('INVALID_URL (parse 失敗)', () => {
    it('不正な文字列は INVALID_URL', () => {
      const result = validateUrl('not a url');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_URL');
      }
    });

    it('空文字列は INVALID_URL', () => {
      const result = validateUrl('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_URL');
      }
    });

    it('https:// のみはホストなしなので INVALID_URL または BLOCKED_URL', () => {
      const result = validateUrl('https://');
      expect(result.ok).toBe(false);
    });
  });

  describe('BLOCKED_URL: スキーム制限', () => {
    it('http スキームはデフォルトで拒否される (BLOCKED_URL)', () => {
      const result = validateUrl('http://example.com', { allowHttp: false });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('allowHttp 未指定の場合 http は拒否される', () => {
      const result = validateUrl('http://example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('file:// は拒否される', () => {
      const result = validateUrl('file:///etc/passwd');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('javascript: は拒否される', () => {
      const result = validateUrl('javascript:alert(1)');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('ftp:// は拒否される', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('data: URL は allowData=false で BLOCKED_URL', () => {
      const result = validateUrl('data:image/png;base64,abc', { allowData: false });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });
  });

  describe('BLOCKED_URL: localhost / loopback', () => {
    it('localhost は拒否される', () => {
      const result = validateUrl('https://localhost');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('127.0.0.1 は拒否される', () => {
      const result = validateUrl('https://127.0.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('127.255.0.1 は 127.0.0.0/8 範囲内なので拒否される', () => {
      const result = validateUrl('https://127.255.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('[::1] (IPv6 loopback) は拒否される', () => {
      const result = validateUrl('https://[::1]');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('0.0.0.0 は拒否される', () => {
      const result = validateUrl('https://0.0.0.0');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });
  });

  describe('BLOCKED_URL: Private IP', () => {
    it('10.0.0.1 は Private IP なので拒否される', () => {
      const result = validateUrl('https://10.0.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('172.16.0.1 は Private IP (172.16/12) なので拒否される', () => {
      const result = validateUrl('https://172.16.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('172.31.0.1 は Private IP (172.16/12 末端) なので拒否される', () => {
      const result = validateUrl('https://172.31.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('192.168.0.1 は Private IP なので拒否される', () => {
      const result = validateUrl('https://192.168.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });
  });

  describe('BLOCKED_URL: Link-Local', () => {
    it('169.254.1.1 は Link-Local なので拒否される', () => {
      const result = validateUrl('https://169.254.1.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('169.254.0.1 は Link-Local なので拒否される', () => {
      const result = validateUrl('https://169.254.0.1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });
  });

  describe('BLOCKED_URL: IPv6 ULA', () => {
    it('[fc00::1] は IPv6 ULA なので拒否される', () => {
      const result = validateUrl('https://[fc00::1]');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('[fd00::1] は IPv6 ULA なので拒否される', () => {
      const result = validateUrl('https://[fd00::1]');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });
  });

  describe('BLOCKED_URL: IPv4-mapped IPv6 (SSRF バイパス対策)', () => {
    it('[::ffff:127.0.0.1] (mapped loopback) は拒否される', () => {
      const result = validateUrl('https://[::ffff:127.0.0.1]');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('[::ffff:192.168.1.1] (mapped private) は拒否される', () => {
      const result = validateUrl('https://[::ffff:192.168.1.1]');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('[::ffff:10.0.0.1] (mapped private 10/8) は拒否される', () => {
      const result = validateUrl('https://[::ffff:10.0.0.1]');
      expect(result.ok).toBe(false);
    });

    it('[::ffff:8.8.8.8] (mapped public) は許可される', () => {
      const result = validateUrl('https://[::ffff:8.8.8.8]');
      expect(result.ok).toBe(true);
    });
  });

  describe('BLOCKED_URL: broadcast / 大文字 hostname', () => {
    it('255.255.255.255 (broadcast) は拒否される', () => {
      const result = validateUrl('https://255.255.255.255');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('LOCALHOST (大文字) も localhost として拒否される', () => {
      // URL.hostname は通常小文字に正規化するが、isPrivateOrLoopbackHost を直接呼ぶケース対策
      const result = validateUrl('https://LOCALHOST/path');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });

    it('[::] (IPv6 unspecified) は拒否される', () => {
      const result = validateUrl('https://[::]');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('BLOCKED_URL');
      }
    });
  });
});

describe('isPrivateOrLoopbackHost', () => {
  it('127.0.0.1 は true', () => {
    expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
  });

  it('example.com は false', () => {
    expect(isPrivateOrLoopbackHost('example.com')).toBe(false);
  });

  it('192.168.1.1 は true', () => {
    expect(isPrivateOrLoopbackHost('192.168.1.1')).toBe(true);
  });

  it('10.10.10.10 は true', () => {
    expect(isPrivateOrLoopbackHost('10.10.10.10')).toBe(true);
  });

  it('172.20.0.1 は true (172.16/12 範囲内)', () => {
    expect(isPrivateOrLoopbackHost('172.20.0.1')).toBe(true);
  });

  it('172.32.0.1 は false (172.16/12 範囲外)', () => {
    expect(isPrivateOrLoopbackHost('172.32.0.1')).toBe(false);
  });

  it('169.254.1.1 は true (Link-Local)', () => {
    expect(isPrivateOrLoopbackHost('169.254.1.1')).toBe(true);
  });

  it('0.0.0.0 は true', () => {
    expect(isPrivateOrLoopbackHost('0.0.0.0')).toBe(true);
  });

  it('localhost は true', () => {
    expect(isPrivateOrLoopbackHost('localhost')).toBe(true);
  });

  it('::1 は true (IPv6 loopback)', () => {
    expect(isPrivateOrLoopbackHost('::1')).toBe(true);
  });

  it('fc00::1 は true (IPv6 ULA)', () => {
    expect(isPrivateOrLoopbackHost('fc00::1')).toBe(true);
  });

  it('fd12::1 は true (IPv6 ULA)', () => {
    expect(isPrivateOrLoopbackHost('fd12::1')).toBe(true);
  });

  it('2001:db8::1 は false (グローバル IPv6)', () => {
    expect(isPrivateOrLoopbackHost('2001:db8::1')).toBe(false);
  });

  it('8.8.8.8 は false', () => {
    expect(isPrivateOrLoopbackHost('8.8.8.8')).toBe(false);
  });
});
