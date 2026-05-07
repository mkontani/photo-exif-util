# Photo EXIF Util

> 写真の EXIF メタデータを表示・分析・削除する Chrome 拡張機能。
> **完全クライアントサイド処理** — データは端末外に一切送信されません。

## 機能

- 📷 JPEG / PNG / WebP の EXIF メタデータを即時解析
- 🗺️ GPS・デバイス・シリアル番号など **プライバシーリスクを可視化**
- 🧹 メタデータをカテゴリ別に削除し、クリーンな画像をダウンロード
- 📐 X / Instagram / LINE / Bluesky など **11 種の SNS プロファイル** に最適化リサイズ
- 🌗 ライト / ダーク / システム連動テーマ
- 🇯🇵 🇺🇸 日本語 / 英語の i18n

## インストール

### Chrome Web Store (公開後)

> Web Store 公開準備中。

### 開発版を手動インストール

1. [Releases ページ](https://github.com/mkontani/photo-exif-util/releases) から `chrome-extension.zip` をダウンロードして展開
2. `chrome://extensions/` を開き「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」で展開したフォルダを選択

## 使い方

1. ブラウザツールバーの拡張アイコン → 「サイドパネルを開く」
   - または右クリック → 「Photo EXIF Util で開く」 (画像を右クリック時)
   - またはショートカット `Ctrl+Shift+E` (mac: `⌘+Shift+E`)
2. 画像をドロップ / ファイル選択 / URL 入力で取り込み
3. 「検査」「削除」「最適化」タブで操作

## プライバシー

本拡張は **画像データを端末外へ一切送信しません**。すべての処理はブラウザ内で完結します。
詳細は [PRIVACY.md](./PRIVACY.md) を参照してください。

## 開発・コントリビュート

開発者向けの情報は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。
リリースフローは [docs/RELEASE.md](./docs/RELEASE.md) を参照してください。

## ライセンス

[MIT](./LICENSE) © 2026 Photo EXIF Util Contributors
