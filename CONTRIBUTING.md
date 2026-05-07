# Contributing

開発者向けセットアップ・コマンド・規約。リリースフローは [docs/RELEASE.md](./docs/RELEASE.md) を参照。

## 前提条件

- Node.js 20+
- pnpm 9.15.4+

## セットアップ

```bash
git clone https://github.com/mkontani/photo-exif-util.git
cd photo-exif-util
pnpm install
pnpm prepare        # lefthook git hooks
```

## 開発

```bash
pnpm dev            # Vite HMR
```

Chrome で `chrome://extensions/` → デベロッパーモード ON →
「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択。

## コマンド

| コマンド | 用途 |
|---------|------|
| `pnpm dev` | 開発サーバー (HMR) |
| `pnpm build` | 本番ビルド (typecheck + vite build) |
| `pnpm typecheck` | TypeScript 型チェック |
| `pnpm lint` / `pnpm lint:fix` | Biome lint |
| `pnpm format` | Biome format |
| `pnpm test` | Vitest 一回実行 |
| `pnpm test:watch` | Vitest watch モード |
| `pnpm test:coverage` | カバレッジ付きテスト (threshold 強制) |
| `pnpm vitest run path/to/file.test.ts` | 単一テストファイル実行 |
| `pnpm vitest run -t "テスト名"` | 名前一致でテスト絞り込み |
| `pnpm test:e2e` | Playwright E2E (要 `RUN_E2E=true`) |
| `pnpm gen:icons` | プレースホルダアイコンを再生成 (開発用、本番アイコンは手動差し替え。詳細は `docs/RELEASE.md` 参照) |
| `pnpm pack:zip` | 配布 zip 生成 |
| `pnpm release` | gen:icons + build + pack:zip 一気通貫 |

## カバレッジ要件

- 全体: 80% 以上
- `src/core/**`: lines/funcs/stmts 90%+ / branches 75%+

`pnpm test:coverage` で閾値未達なら exit 1。

## アーキテクチャ

詳細は [CLAUDE.md](./CLAUDE.md) を参照。要点のみ:

- **依存方向**: `src/ui` → `src/state` → `src/core` / `src/utils` / `src/messaging`
- **純粋関数 + DI** でブラウザ API (`chrome.*`、`OffscreenCanvas`、`pica`) を分離。
  jsdom で動かないものは `vitest.config.ts` の `coverage.exclude` に追加。
- **SSRF / メッセージング多層防御**: `validateUrl` (private IP 全網羅) +
  `redirect: 'manual'` + zod schema + `isExtensionSender` + magic bytes。
  この防御を緩める変更は禁止。
- **immutable + typed error**: `extractErrorInfo(unknown, fallback)` を使用。

## プロジェクト構成

```
src/
  core/        ビジネスロジック (exif/image/ingest/sns)
  ui/          Solid.js UI (popup/side-panel/options/components)
  state/       純粋 reducer
  messaging/   zod schema + Background SW bridge
  background/  Service Worker
  utils/       純粋ヘルパ
tests/
  unit/        Vitest 純粋関数テスト
  component/   @solidjs/testing-library
  e2e/         Playwright (opt-in)
  helpers/     fixture 動的生成
public/
  _locales/    i18n 辞書 (en/ja)
  icons/       拡張アイコン
```

## コミット規約

Conventional Commits 形式:

```
feat: 新機能
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント
test: テスト
chore: その他
```

## デバッグ

### 拡張のロード
`chrome://extensions/` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」→ `dist/` を選択

### Service Worker
`chrome://extensions/` → 対象拡張の「Service Worker」リンク → DevTools Console

### Side Panel
Side Panel 上で右クリック → 「検証」

### Options ページ
`chrome://extensions/` → 拡張カードの「拡張機能のオプション」リンク

### CSP 違反
DevTools Console で報告される。`manifest.json` の `content_security_policy.extension_pages` を確認。

### FOUC (テーマ切替フラッシュ)
`dist/theme-pre.js` が出力されているか、各 `index.html` で読み込まれているかを確認。
