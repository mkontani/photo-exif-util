# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chrome 拡張 (Manifest V3)。画像 EXIF メタデータの可視化・削除・SNS 最適化を **完全クライアントサイド** で実行する。画像は端末外に一切送信しない。

## Commands

| Command | 用途 |
|---|---|
| `pnpm dev` | Vite HMR 開発サーバ |
| `pnpm build` | 本番ビルド (typecheck + vite build) |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm lint` / `pnpm lint:fix` | Biome lint |
| `pnpm test` | Vitest run (一回実行) |
| `pnpm test:watch` | Vitest watch |
| `pnpm test:coverage` | カバレッジ計測 (threshold 強制) |
| `pnpm vitest run path/to/file.test.ts` | 単一テストファイル実行 |
| `pnpm vitest run -t "テスト名"` | 名前一致でテスト絞り込み |
| `pnpm test:e2e` | Playwright E2E (要 `RUN_E2E=true` opt-in、要 `pnpm build` 済み) |
| `pnpm gen:icons` | プレースホルダアイコン (青円+P) を `public/icons/` に **生成 (skip-if-exists)**。`--force` で既存も上書き |
| `pnpm pack:zip` | `dist/` を `photo-exif-util-v<VERSION>.zip` に圧縮 (バージョンは `src/manifest.config.ts` から抽出) |
| `pnpm release` | `build && pack:zip` (本番アイコン保護のため `gen:icons` は含まない) |

**Coverage threshold**: 全体 80%、`src/core/**` は lines/funcs/stmts 90% / branches 75%。`pnpm test:coverage` がこれを満たさないと exit 1。

## Architecture

### レイヤー構造 (依存方向 厳守)

```
src/ui/**        ← Solid.js UI (coverage exclude、テストは tests/component/)
   ↓
src/state/**     ← 純粋 reducer + Solid signal (フルテスト)
   ↓
src/core/**      ← ビジネスロジック (純粋関数、フルテスト 90%+ 強制)
   ├ exif/       ← parseExif / stripExif (JPEG: piexifjs、PNG/WebP: 自前 chunk parser)
   ├ image/      ← dimensions / quality-search (純粋) + decode/resize/encode (ブラウザ依存、coverage exclude)
   ├ ingest/     ← validateUrl (SSRF対策中核) / validateFile / magic-bytes / ingest pipeline
   └ sns/        ← SNS_PROFILES (11種) / applySnsProfile (DI パイプライン)
   ↓
src/utils/**     ← 純粋ヘルパ (error / base64 / blob / crc32 / detect-format / filename / strip-options)
src/messaging/** ← zod スキーマ + Background SW ↔ Side Panel bridge
```

**`src/background/index.ts`**: Service Worker。`chrome.runtime.onMessage` で `INGEST_REQUEST` を受け、`url-fetcher.ts` (SSRF多層防御済み) で fetch → base64 化して Side Panel に返す。`chrome.commands` で `Ctrl+Shift+E` を Side Panel 起動にマップ。

### 設計の核となる 3 原則

**1. 純粋関数 + DI でブラウザ API を分離**

`createImageBitmap` / `OffscreenCanvas` / `pica` / `chrome.*` / `fetch` は jsdom で動かないため、薄いアダプタとして切り出して `coverage.exclude` (`vitest.config.ts` 参照)。コアロジックは DI でモック注入してフルテスト:

```ts
// 例: src/core/sns/apply.ts
applySnsProfile(blob, profile, deps: SnsApplyDeps);  // deps = { decode, resize, encode, strip }
// テストでは vi.fn() のモック注入でパイプライン全体検証
// 本番は defaultSnsApplyDeps を使用 (動的 import で chunk 分割)
```

同様パターンを `src/core/ingest/ingest.ts` (`IngestDeps.fetchUrl`)、`src/messaging/bridge.ts` (`MessageSender`)、`src/ui/components/StripPanel.tsx` (`onStripExif`)、`src/ui/components/OptimizePanel.tsx` (`onApply`) で踏襲。**新しいブラウザ依存処理を追加するときは必ずこのパターンに従い、coverage exclude も忘れない**。

**2. SSRF / メッセージング多層防御**

URL を扱う全経路で多層検証:

1. `src/core/ingest/url-validator.ts` の `validateUrl` (https/http/data/blob 限定、private IP 全レンジ + IPv6 ULA + IPv4-mapped IPv6 hex グループ形式まで網羅、loopback/link-local 拒否、broadcast 拒否)
2. Background SW: `redirect: 'manual'` で 3xx は `opaqueredirect` として `FETCH_FAILED` 化 (リダイレクト先 SSRF 防止)
3. Content-Length 事前チェック + 実 Blob.size 二重チェック (50MB cap = `MAX_BLOB_SIZE_BYTES`)
4. `src/messaging/protocol.ts` の zod `discriminatedUnion` + `httpUrlSchema` (refine で `javascript:`/`data:` 拒否) + `dataBase64` 70MB max + MIME を `z.enum(['image/jpeg','image/png','image/webp'])` で限定
5. Background SW: `isExtensionSender(sender.id, chrome.runtime.id)` で外部送信元拒否 → `messageSchema.safeParse` → exhaustive switch + `never` ガード
6. ファイル入力: `Blob.type` を信用せず magic bytes (`detectImageFormat`) で再検証

**この防御を緩める変更は禁止**。新しい URL/メッセージ受信経路を追加する場合、上記すべてを通すこと。

**3. immutable + readonly 徹底**

すべての state/reducer/エンジンは新規オブジェクトを返す。`readonly` を全フィールドに付与。エラーは `throw new Error` ではなく **typed error の rejected Promise** (`{ code, message }` 形式、`extractErrorInfo` で安全に展開)。`extractErrorInfo(unknown, fallbackCode)` を使えば `Error` / `{code,message}` / プリミティブ / null を一貫サニタイズ可能。

### テスト戦略

- **`tests/unit/`** — 純粋関数 (Vitest + jsdom)。`src/core/**`、`src/state/**`、`src/utils/**`、`src/messaging/**` の本体テスト
- **`tests/component/`** — Solid コンポーネント (`@solidjs/testing-library`)。UI は coverage exclude だがテスト自体は書く
- **`tests/e2e/`** — Playwright smoke (要 `RUN_E2E=true` + 事前 `pnpm build`、headless: false なので CI では xvfb 必須)
- **Fixture は実画像を同梱せず動的生成**: `tests/helpers/build-fixtures.ts` が決定論的バイト列で JPEG/PNG/WebP を組み立て `tests/fixtures/.cache/` に書き出し。`vi.beforeAll(buildAllFixtures)` でテスト時に呼ぶ。新フィクスチャは `FIXTURE_BUILDERS` 配列に追加すれば両関数 (`buildAllFixtures` / `rebuildAllFixtures`) から自動生成
- **defensive 分岐は `/* c8 ignore */`** で除外 (バイナリパーサの境界ガード等、実テストで到達不能な防御コード)

### i18n

- `_locales/{en,ja}/messages.json` の辞書 + `src/ui/i18n/t.ts` の `t(key, substitutions?, fallback?)` ヘルパ
- テスト時は `setI18nTestDict({...})` で chrome.i18n を bypass 可能
- placeholder は **英字+アンダースコア** で命名 (`error_detail`、`risk_level` 等。Chrome Extension i18n 仕様準拠)
- 新しい UI 文字列を追加する際: 必ず両言語 (en/ja) に同じキーを追加 (現在 48 キーで対称)

### 依存パッケージ方針

- バージョンは **完全固定** (caret/tilde 禁止、`package.json` 参照)
- `pnpm.overrides.rollup` で CVE 修正版にピン留め (devtools chain)
- `@crxjs/vite-plugin@2.0.0-beta.28` は deprecated 警告あり、stable リリース後に移行検討

### Web Store 提出時の要注意

- `public/icons/icon-{16,32,48,128}.png` は本番アイコン (commit 済)。`pnpm gen:icons` はプレースホルダ (青円+P) を生成するスクリプトで、既存ファイルは skip するので通常は安全。差し替え時は `--force` または該当 PNG を一旦削除する
- `manifest.config.ts` の `optional_host_permissions: ['<all_urls>']` は審査で justification 必須 (URL 入力経路、Background SW のみで使用、コンテンツスクリプトから直接アクセスしない旨を説明)
- `docs/PRIVACY.md` は GitHub Pages (source: `main` / `/docs`) で `https://mkontani.github.io/photo-exif-util/PRIVACY` に公開済み。Web Store の Privacy Policy URL として登録する
- 詳細は `README.md` の "Submit to Chrome Web Store" 参照

## Repository conventions

- **コメントは「なぜ」のみ**。「なに」コメントは型と命名で表現する
- **新規ブラウザ依存ファイルは `vitest.config.ts` の `coverage.exclude` に追加**忘れない (chrome.* / OffscreenCanvas / `URL.createObjectURL` 等)
- **Phase 1-9 の API 変更は禁止**。`parseExif` / `stripExif` / `applySnsProfile` / `validateUrl` / `messageSchema` 等の signature は固定。拡張する場合は新規エクスポート
- **コードコメントは日本語、識別子は英語**
