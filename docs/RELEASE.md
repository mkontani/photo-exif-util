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

## アイコン素材

本番アイコンは `public/icons/icon-{16,32,48,128}.png` にコミット済み。
元データ (高解像度) は `assets/source-icons/icon-original.png` に保管。

`pnpm gen:icons` は **暫定プレースホルダ生成スクリプト** であり、
本番リリースでは使用しない。アイコンを差し替える場合は元データから手動で
各サイズへエクスポートし、`public/icons/` を直接上書きする。

### 差し替え手順

1. `assets/source-icons/icon-original.png` を画像エディタで開き、各サイズで PNG エクスポート:
   - 16×16 (ファビコン / ツールバー小)
   - 32×32 (Windows 高 DPI)
   - 48×48 (拡張管理ページ)
   - 128×128 (Web Store ギャラリー、提出時必須)
2. `public/icons/icon-{16,32,48,128}.png` を上書き
3. `assets/source-icons/icon-original.png` も新しい元データに差し替え
4. `src/manifest.config.ts` の version を bump して push → リリース自動生成

### Web Store プロモ素材

`promos/promo-small.png` は Chrome Web Store の "Small promo tile" (440×280) 用。
追加サイズ (`promo-large.png` 920×680、`promo-marquee.png` 1400×560 など) を作成した場合も
`promos/` に配置する。

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
5. `host_permissions: ['*://*/*']` の Justification を記入:
   - 用途: ユーザーが入力した URL / 右クリックメニューから取得した画像 URL に対する fetch
   - MV3 では Background SW からの fetch でも対象ホストの host_permissions が必要 (CORS 制約)
   - Background Service Worker 経由で fetch、コンテンツスクリプトから直接アクセスしない
   - `*://*/*` は http / https のみ許可し、file:// 等は除外している (`<all_urls>` よりも狭い)
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
