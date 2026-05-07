# Release

リリースプロセス: バージョン更新 → 自動リリース → Chrome Web Store 提出。

## 自動リリースフロー

`src/manifest.config.ts` の `version` を bump して main ブランチに push すると、
GitHub Actions (`.github/workflows/release.yml`) が以下を自動実行:

1. 現在の version と既存 git tag を比較
2. 新しい version なら:
   - `pnpm release` で `chrome-extension.zip` を生成
   - `vX.Y.Z` タグを作成
   - GitHub Release を作成し `chrome-extension.zip` を asset として添付

## バージョン更新手順

1. `src/manifest.config.ts` の `version: '0.1.0'` を新しい semver に更新
2. `CHANGELOG.md` を更新
3. commit:
   ```bash
   git commit -am "chore: release v0.2.0"
   git push
   ```
4. GitHub Actions が release を自動生成 (https://github.com/mkontani/photo-exif-util/releases)

## アイコン差し替え (Web Store 公開前 必須)

`pnpm gen:icons` で生成される `public/icons/icon-*.png` は **プレースホルダ**
(青い円 + 白い「P」) です。Web Store 審査では実アイコンが必要です。

### 差し替え手順

1. 以下のサイズで PNG を用意:
   - 16×16 (ファビコン / ツールバー小)
   - 32×32 (Windows 高 DPI)
   - 48×48 (拡張管理ページ)
   - 128×128 (Web Store ギャラリー、提出時必須)
2. `public/icons/icon-{16,32,48,128}.png` を上書き
3. version を bump して push → リリース自動生成

### 推奨ツール

- [Inkscape](https://inkscape.org/) — 無料、SVG → PNG エクスポート
- Figma / Adobe Illustrator → 各サイズで Export

## Chrome Web Store 提出

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) にアクセス
2. 「新しいアイテムを追加」→ Releases から最新の `chrome-extension.zip` をダウンロードしてアップロード
3. 必要情報を入力:
   - スクリーンショット (1280×800 または 640×400 を最低 1 枚)
   - アイコン画像 (128×128 PNG)
   - 説明文 (英語必須、日本語は任意)
4. プライバシーの同意:
   - [PRIVACY.md](../PRIVACY.md) を GitHub Pages 等で公開し URL を登録
   - 「ユーザーデータを収集しない」を選択 (本拡張はデータを外部送信しません)
5. `optional_host_permissions: ['<all_urls>']` の Justification を記入:
   - 用途: ユーザーが入力した URL から画像を取得するため
   - Background Service Worker 経由で fetch、コンテンツスクリプトから直接アクセスしない旨
6. 審査提出 → 通常 1〜3 営業日

## Manual release (緊急時)

CI が使えない場合の手動リリース:

```bash
pnpm release                                              # zip 生成
VERSION=$(grep -oP "version:\s*'\K[^']+" src/manifest.config.ts | head -1)
git tag v${VERSION}
git push --tags
gh release create v${VERSION} chrome-extension.zip --generate-notes
```
