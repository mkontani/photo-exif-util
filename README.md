# Photo EXIF Util

Chrome 拡張機能 — 写真の EXIF メタデータを表示・分析・削除します。完全クライアントサイド処理。

## 概要

- JPEG / PNG / WebP の EXIF メタデータを即時解析
- GPS・デバイス・シリアル番号などのプライバシーリスクを可視化
- メタデータを選択して削除し、クリーンな画像をダウンロード
- サイドパネル UI でブラウジングしながら操作可能
- **データは端末外に一切送信されない**

## 技術スタック

| 領域 | 採用技術 |
|------|---------|
| 言語 | TypeScript 5.7 (strict) |
| UI フレームワーク | Solid.js 1.9 + Tailwind CSS v4 |
| ビルド | Vite 6 + @crxjs/vite-plugin |
| EXIF パース | exifr 7.x |
| テスト | Vitest + Playwright |
| Lint/Format | Biome 1.9 |
| パッケージマネージャ | pnpm 9.x |

## 開発者向けセットアップ

### 前提条件

- Node.js 20+
- pnpm 9.15.4+

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/mkontani/photo-exif-util.git
cd photo-exif-util

# 依存関係をインストール
pnpm install

# git hooks をセットアップ (自動的に実行されます)
pnpm prepare
```

### 開発

```bash
# 開発サーバーを起動 (HMR 有効)
pnpm dev

# Chrome で拡張をロード:
# 1. chrome://extensions/ を開く
# 2. 「デベロッパーモード」を有効化
# 3. 「パッケージ化されていない拡張機能を読み込む」で dist/ フォルダを選択
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 (Vite HMR) |
| `pnpm build` | プロダクションビルド |
| `pnpm typecheck` | TypeScript 型チェック |
| `pnpm lint` | Biome lint チェック |
| `pnpm lint:fix` | Biome lint 自動修正 |
| `pnpm format` | Biome フォーマット |
| `pnpm test` | Vitest 単体テスト実行 |
| `pnpm test:watch` | Vitest ウォッチモード |
| `pnpm test:coverage` | カバレッジ付きテスト |
| `pnpm test:e2e` | Playwright E2E テスト (Phase 7~) |
| `pnpm pack:zip` | 配布用 ZIP 生成 |

## テストカバレッジ要件

- 全体: 80% 以上 (lines / branches / functions / statements)
- `src/core/`: 90% 以上

## プロジェクト構成

```
src/
  core/          # ビジネスロジック (EXIF パース・strip・pipeline)
    exif/        # EXIF 解析
  ui/            # Solid.js UI コンポーネント
    popup/       # ポップアップ
    side-panel/  # サイドパネル (メイン UI)
  background/    # Service Worker
  styles/        # グローバル CSS (Tailwind)
tests/
  unit/          # Vitest ユニットテスト
  helpers/       # テストヘルパー・フィクスチャ
  fixtures/      # テスト用画像 (動的生成)
  e2e/           # Playwright E2E テスト (Phase 7~)
public/
  _locales/      # i18n メッセージ (en / ja)
  icons/         # 拡張アイコン (Phase 7~)
```

## Build for Chrome Web Store

```bash
# 1. アイコンを生成 (初回のみ、差し替える場合も再実行)
pnpm gen:icons

# 2. プロダクションビルド
pnpm build

# 3. 配布用 ZIP を生成
pnpm pack:zip
# → chrome-extension.zip が生成される
```

生成された `chrome-extension.zip` を Chrome Web Store Developer Dashboard にアップロードします。

### アイコン差し替え (Web Store 公開前 必須)

> `pnpm gen:icons` で生成される `public/icons/icon-*.png` は **プレースホルダ** (青い円 + 白い「P」) です。
> Chrome Web Store 審査では実際のアプリアイコンが必要です。必ず本番用アイコンに差し替えてから提出してください。

| サイズ | 用途 |
|--------|------|
| 16x16  | ファビコン / ツールバー (小) |
| 32x32  | Windows 高 DPI ツールバー |
| 48x48  | 拡張機能管理ページ |
| 128x128 | Web Store ギャラリー (提出時必須) |

#### 差し替え手順

1. 以下のサイズで PNG を用意:
   - 16×16 / 32×32 / 48×48 / 128×128
2. `public/icons/icon-{16,32,48,128}.png` を上書き
3. `pnpm release` で再パッケージング

#### 推奨ツール

- [Inkscape](https://inkscape.org/) (無料 / SVG → PNG エクスポート)
- Figma / Adobe Illustrator → 各サイズで Export
- macOS: Preview / Affinity Photo / Pixelmator

## Submit to Chrome Web Store

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) にアクセス
2. 「新しいアイテムを追加」→ `chrome-extension.zip` をアップロード
3. 必要情報を入力:
   - スクリーンショット (1280×800 または 640×400 を最低 1 枚)
   - アイコン画像 (128×128 PNG)
   - 説明文 (英語必須、日本語は任意)
4. プライバシーの同意:
   - `PRIVACY.md` の内容を元にプライバシーポリシー URL を登録
   - 「ユーザーデータを収集しない」を選択 (本拡張はデータを外部送信しません)
5. `optional_host_permissions: ['<all_urls>']` について Justification を記入:
   - 用途: URL から画像を取得するため (ユーザーが明示的に入力した URL のみ)
   - Background Service Worker 経由で fetch し、コンテンツスクリプトから直接アクセスしない
6. 審査提出 → 通常 1〜3 営業日で審査完了

## Run E2E Tests

E2E テストには `pnpm build` で生成した `dist/` が必要です。

```bash
# 1. 先にビルド
pnpm build

# 2. E2E テストを実行 (RUN_E2E=true で opt-in)
RUN_E2E=true pnpm test:e2e
```

CI 環境では仮想ディスプレイ (xvfb) が必要です:

```bash
# Ubuntu / GitHub Actions の例
sudo apt-get install -y xvfb
xvfb-run --auto-servernum pnpm test:e2e
```

MV3 拡張は `headless: false` が必要なため、headless 環境での実行には xvfb が必須です。

## Debugging Tips

### 拡張の読み込み確認

1. `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」で `dist/` フォルダを選択
4. エラーがあれば拡張カードにエラーアイコンが表示される

### Service Worker のデバッグ

- `chrome://extensions/` → 対象拡張の「Service Worker」リンクをクリック
- DevTools の Console でログ確認
- `chrome.runtime.lastError` に自動接続エラーが記録されることがある

### Side Panel のデバッグ

- Side Panel を開いた状態で右クリック → 「検証」
- または `chrome://extensions/` → 拡張の「詳細」→ 「ビューを検証: サイドパネル」

### Options ページのデバッグ

- `chrome://extensions/` → 拡張カードの「拡張機能のオプション」リンク
- または `chrome-extension://<ID>/src/ui/options/index.html` に直接アクセス

### CSP 違反のデバッグ

- DevTools の Console で `Content-Security-Policy` 違反が報告される
- `manifest.json` の `content_security_policy.extension_pages` を確認
- Tailwind v4 は `style-src 'unsafe-inline'` が必須

### FOUC (フラッシュ) が発生する場合

- `theme-pre.js` が正しく読み込まれているか確認
- `dist/` に `theme-pre.js` が含まれているか `ls dist/` で確認
- `src/ui/side-panel/index.html` と `src/ui/options/index.html` に
  `<script src="/theme-pre.js"></script>` が含まれているか確認

## CI / CD

### GitHub Actions の例

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:coverage
      - run: pnpm build
      - run: pnpm pack:zip
      - uses: actions/upload-artifact@v4
        with:
          name: chrome-extension
          path: chrome-extension.zip
```

## ライセンス

[MIT](./LICENSE) — Copyright (c) 2026 Photo EXIF Util Contributors

## プライバシー

[PRIVACY.md](./PRIVACY.md) を参照してください。
