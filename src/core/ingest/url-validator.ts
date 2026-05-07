/**
 * URL バリデーション (SSRF 対策)。
 * 外部から受け取った URL を fetch する前に必ずこの関数を通す。
 */

export type UrlValidationResult =
  | { readonly ok: true; readonly url: URL }
  | {
      readonly ok: false;
      readonly code: 'INVALID_URL' | 'BLOCKED_URL';
      readonly reason: string;
    };

export interface UrlValidatorOptions {
  /** http スキームを許可するか。外部ネットワークの mixed content を防ぐためデフォルト false */
  readonly allowHttp?: boolean;
  /** data: URL を許可するか。拡張内部生成データ用にデフォルト true */
  readonly allowData?: boolean;
  /** blob: URL を許可するか。拡張内部生成データ用にデフォルト true */
  readonly allowBlob?: boolean;
}

/**
 * IPv4 アドレス文字列を数値に変換する。
 * 変換できない場合は null を返す。
 */
function parseIPv4(host: string): number | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    // 空文字列・数値以外・範囲外は不正
    if (!/^\d+$/.test(part)) return null;
    const num = Number(part);
    if (num < 0 || num > 255) return null;
    result = (result << 8) | num;
  }
  // JavaScript のビット演算は符号付き 32bit なので unsigned に変換
  return result >>> 0;
}

/**
 * IPv6 アドレス文字列の先頭 16 ビットを取得する。
 * bracketed 形式 ([::1]) は事前に除去してから渡すこと。
 * 解析できない場合は null を返す。
 */
function parseIPv6FirstByte(host: string): number | null {
  // "::" を展開して最初のグループを取得する
  // 単純化: "::" で始まる場合は先頭グループが 0
  if (host === '::1' || host === '::') return 0x0000;

  // グループを分割
  const parts = host.split(':');
  if (parts.length < 2) return null;

  const firstPart = parts[0];
  if (firstPart === undefined || firstPart === '') return 0x0000;

  const val = Number.parseInt(firstPart, 16);
  if (Number.isNaN(val)) return null;
  return val;
}

/**
 * ホスト名が private/loopback/link-local に該当するか判定する。
 * hostname プロパティは URL.hostname で取得した値 (IPv6 は bracket なし) を渡すこと。
 *
 * 拒否対象:
 *   - "localhost" リテラル
 *   - 127.0.0.0/8 (loopback)
 *   - 0.0.0.0 (bind-all = ローカルアクセス相当)
 *   - 10.0.0.0/8 (private)
 *   - 172.16.0.0/12 (private)
 *   - 192.168.0.0/16 (private)
 *   - 169.254.0.0/16 (link-local)
 *   - ::1 (IPv6 loopback)
 *   - fc00::/7 (IPv6 ULA: fc00:: 〜 fdff::)
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  // 大文字混じり (LOCALHOST 等) も正規化して比較できるように小文字化
  const lower = hostname.toLowerCase();

  // localhost リテラルは無条件で拒否
  if (lower === 'localhost') return true;

  // IPv6 loopback
  if (lower === '::1') return true;

  // IPv6: bracketed 形式で渡された場合も考慮して bracket を除去
  const cleanHost = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;

  // IPv6 loopback (::1) と unspecified (::; IPv6 版 0.0.0.0、ローカルバインド相当)
  if (cleanHost === '::1' || cleanHost === '::') return true;

  // IPv6 ULA (fc00::/7) および IPv4-mapped IPv6 (::ffff:x.x.x.x) のチェック
  if (cleanHost.includes(':')) {
    // IPv4-mapped IPv6 ドット表記: ::ffff:192.168.1.1
    const mappedDotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(cleanHost);
    if (mappedDotted?.[1] !== undefined) {
      return isPrivateOrLoopbackHost(mappedDotted[1]);
    }
    // IPv4-mapped IPv6 hex グループ形式 (WHATWG URL の正規化結果):
    //   ::ffff:127.0.0.1 → ::ffff:7f00:1
    //   ::ffff:192.168.1.1 → ::ffff:c0a8:101
    // 末尾 2 グループを 16bit ずつパースして IPv4 32bit に展開し再評価する
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(cleanHost);
    if (mappedHex?.[1] !== undefined && mappedHex[2] !== undefined) {
      const high = Number.parseInt(mappedHex[1], 16);
      const low = Number.parseInt(mappedHex[2], 16);
      const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      return isPrivateOrLoopbackHost(ipv4);
    }

    const firstWord = parseIPv6FirstByte(cleanHost);
    if (firstWord !== null) {
      const firstByte = (firstWord >> 8) & 0xff;
      // fc00::/7 = 先頭バイトの上位 7 ビットが 1111110x = 0xfc または 0xfd
      if (firstByte === 0xfc || firstByte === 0xfd) return true;
    }
    return false;
  }

  // IPv4 数値表現チェック
  const ip = parseIPv4(cleanHost);
  if (ip === null) return false;

  // 0.0.0.0 (bind-all)
  if (ip === 0) return true;

  // 255.255.255.255 (limited broadcast)
  if (ip === 0xffffffff) return true;

  // 127.0.0.0/8 (loopback): 先頭バイトが 127
  if (ip >>> 24 === 127) return true;

  // 10.0.0.0/8 (private): 先頭バイトが 10
  if (ip >>> 24 === 10) return true;

  // 172.16.0.0/12 (private): 172.16 〜 172.31
  // 上位 12 ビット = 0xAC1 (172 << 4 | 1)
  if (ip >>> 20 === 0xac1) return true;

  // 192.168.0.0/16 (private): 上位 16 ビットが 0xC0A8
  if (ip >>> 16 === 0xc0a8) return true;

  // 169.254.0.0/16 (link-local): 上位 16 ビットが 0xA9FE
  if (ip >>> 16 === 0xa9fe) return true;

  return false;
}

/**
 * URL を SSRF 観点でバリデーションする純粋関数。
 *
 * 許可スキーム:
 *   - https: (常に許可)
 *   - http: (allowHttp=true の場合のみ)
 *   - data: (allowData=true の場合。デフォルト true)
 *   - blob: (allowBlob=true の場合。デフォルト true)
 *
 * 拒否条件:
 *   - URL 構文が不正
 *   - 上記以外のスキーム (file:, ftp:, javascript: 等)
 *   - hostname が private/loopback/link-local
 */
export function validateUrl(input: string, options?: UrlValidatorOptions): UrlValidationResult {
  const allowHttp = options?.allowHttp ?? false;
  const allowData = options?.allowData ?? true;
  const allowBlob = options?.allowBlob ?? true;

  // URL 構文チェック
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, code: 'INVALID_URL', reason: 'Invalid URL syntax' };
  }

  const protocol = parsed.protocol;

  // スキームチェック (ホスト検証より先に行う)
  // 許可スキーム以外は BLOCKED_URL として拒否する (file:, ftp:, javascript: 等)
  if (protocol === 'data:') {
    if (!allowData) {
      return { ok: false, code: 'BLOCKED_URL', reason: 'data: URLs are not allowed' };
    }
    return { ok: true, url: parsed };
  }

  if (protocol === 'blob:') {
    if (!allowBlob) {
      return { ok: false, code: 'BLOCKED_URL', reason: 'blob: URLs are not allowed' };
    }
    return { ok: true, url: parsed };
  }

  if (protocol === 'http:') {
    if (!allowHttp) {
      return {
        ok: false,
        code: 'BLOCKED_URL',
        reason: 'http: URLs are blocked (use https)',
      };
    }
    // http が許可されていても private/loopback はチェックが必要
  } else if (protocol !== 'https:') {
    // file:, ftp:, javascript:, etc. は全て拒否
    return {
      ok: false,
      code: 'BLOCKED_URL',
      reason: `Scheme "${protocol}" is not allowed`,
    };
  }

  // ホストが空の場合は無効 (https:// のみなど)。
  // jsdom/Node では `new URL('https://')` が TypeError なので通常到達せず、
  // 防御的に保持。
  /* c8 ignore next 3 */
  if (parsed.hostname === '') {
    return { ok: false, code: 'INVALID_URL', reason: 'URL has no hostname' };
  }

  // ホストが private/loopback/link-local でないか確認
  // URL.hostname は IPv6 の場合 brackets が除去された形で返る
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    return {
      ok: false,
      code: 'BLOCKED_URL',
      reason: `Host "${parsed.hostname}" is a private or loopback address`,
    };
  }

  return { ok: true, url: parsed };
}
