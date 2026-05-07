# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-08

### Changed
- **エラー表示を全面的に改善**: `code: 内部メッセージ` の生表示から、原因 / 対処方法を
  3 点セットで表示する `ErrorPanel` に置き換え。`getErrorDisplay(code)` 純粋関数で
  17 種類のエラーコードに対し severity (error/warning/info) + タイトル + 説明 +
  対処ヒント の i18n キーを返す。lucide アイコン (AlertCircle / AlertTriangle / Info)
  + severity 別配色で視覚的に区別。
- **画像取り込み完了後にサムネイル + メタ情報サマリ表示** (`ImageSummary`): ファイル名 /
  形式 / サイズ / 寸法 / EXIF フィールド数 / 高リスクフィールド数を一覧表示。
  ユーザーが画像が正しく読み込まれたかを即座に判別可能に。
- **ローディング表示を改善**: 「解析中…」のみだった表示を、フェーズ別 (取得中 / 検証中 /
  EXIF 読取中) + lucide スピナーアニメーションへ変更。
- **DropZone と header の視覚改善**: lucide アイコン (Upload / Link2 / RotateCcw)
  + ヘッダーへの拡張アイコン表示 + drag-over 時のアニメーション + ホバー色強調。

### Added
- `src/utils/error-display.ts` — エラーコード → UI 表示情報マッピングの純粋関数
- `src/utils/format-size.ts` — バイト数 / 寸法を人間可読に整形する純粋関数
- `src/ui/components/ErrorPanel.tsx` — 構造化エラー表示コンポーネント
- `src/ui/components/ImageSummary.tsx` — 画像サマリ + サムネイル表示
- `src/ui/components/LoadingIndicator.tsx` — フェーズ別ローディング表示
- 41 件の i18n キー追加 (en/ja 両言語)

## [0.1.2] - 2026-05-07

### Fixed
- 右クリック「Photo EXIF Util で開く」を選んでもサイドパネルが自動で開かない問題を修正。
  `chrome.sidePanel.open()` は user gesture コンテキスト内で同期的に呼ぶ必要があるが、
  `await chrome.storage.session.set(...)` を先に実行することで user activation が
  失われていた。`sidePanel.open` を listener 先頭で発火させ、storage 書き込みは
  Promise として独立させる順序に修正。

## [0.1.1] - 2026-05-07

### Fixed
- 右クリック「Photo EXIF Util で開く」をクリックしても何も反応しない問題を修正。
  `chrome.runtime.sendMessage` 経由から `chrome.storage.session` 経由の受け渡しに変更し、
  Side Panel が起動時 (onMount) と既に開いている場合 (onChanged) の双方で受信できるようにした。

## [0.1.0] - Initial development

### Added
- Phase 0: プロジェクトスキャフォールド (Vite + Solid.js + Tailwind CSS v4 + Biome + Vitest + Playwright)
- Phase 1: EXIF パース基盤 (categories / risk / parse) の TDD 実装
