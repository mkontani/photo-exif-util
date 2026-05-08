# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-05-08

### Fixed
- 右クリック「Photo EXIF Util で開く」が時間経過後に反応しなくなり、拡張を
  reload しないと復旧しない問題を修正。原因は MV3 Service Worker のライフ
  サイクル制約で、`chrome.contextMenus.onClicked` リスナーを
  `chrome.runtime.onInstalled` の中で `addListener` していたため、SW がアイドル
  停止 → イベントで再起動した際にリスナーが復活せずクリックが捨てられていた。
  リスナー登録 (`registerContextMenuListener`) をトップレベルへ移動し、
  メニュー項目作成 (`createContextMenuEntry`) のみ `onInstalled` 内で 1 回
  実行する形に分離。SW 再起動時もリスナーが必ず再登録されるようになった。

### Added
- `tests/unit/background/context-menu.test.ts`: SW ライフサイクル耐性の
  リグレッションテスト 9 件 (リスナー即時登録、create と addListener の責務
  分離、URL バリデーション、user gesture 維持のための呼び出し順序検証)。

## [0.2.1] - 2026-05-08

### Changed
- 本番アイコン素材に差し替え。`pnpm gen:icons` で生成されていた青円 + P 文字の
  プレースホルダを廃止。
- アイコン元データを `assets/source-icons/icon-original.png` に分離 (1.2 MB)。
  `public/` 配下に置くと Vite が dist にコピーして配布 zip に混入するため、
  `assets/` 配下に移動して配布物から除外した。
- Web Store 用プロモ素材ディレクトリ `assets/promos/` を追加。`promo-small.png`
  (Chrome Web Store の Small promo tile 440×280) を初期コミット。
  ソース素材を `assets/` 配下に集約することで、配布物 (dist) との分離を明確化。

### Docs
- `docs/RELEASE.md`: アイコン差し替え手順を「プレースホルダ生成」から
  「元データから手動エクスポート」に書き換え。

## [0.2.0] - 2026-05-08

### Changed
- **画像サマリを全タブ共通領域に常時表示**: 「いまどの画像を扱っているか」が
  inspect / strip / optimize どのタブを見ていても分かるよう、`<main>` 最上部に
  `ImageSummary` を配置。inspect タブ + 成功状態のときだけフルサマリ
  (リスク情報含む)、それ以外はコンパクト表示。
- **ダークモード対応強化**: Tailwind v4 の `@custom-variant dark` を `globals.css`
  に定義し、`data-theme="dark"` および `prefers-color-scheme: dark` の双方で
  `dark:` バリアントが適用されるように。`ImageSummary` / ヘッダー / タブ間
  プレースホルダの白背景・薄文字色を dark バリアントの slate 系トークンに切替し、
  「白背景に白文字で見えない」問題を解消。
- **DropZone は idle/error 時のみ表示**: success 時は ImageSummary が代替で
  画像情報を見せるため、DropZone の重複表示を抑制 (リセット押下で戻る)。

### Changed (2026-05-08 earlier in the day)
- **エラー表示を全面的に改善**: `code: 内部メッセージ` の生表示から、原因 / 対処方法を
  3 点セットで表示する `ErrorPanel` に置き換え。`getErrorDisplay(code)` 純粋関数で
  17 種類のエラーコードに対し severity (error/warning/info) + タイトル + 説明 +
  対処ヒント の i18n キーを返す。lucide アイコン (AlertCircle / AlertTriangle / Info)
  + severity 別配色で視覚的に区別。
- **画像取り込み完了後にサムネイル + メタ情報サマリ表示** (`ImageSummary`): ファイル名 /
  形式 / サイズ / 寸法 / EXIF フィールド数 / 高リスクフィールド数を一覧表示。
  ユーザーが画像が正しく読み込まれたかを即座に判別可能に。
- **ローディング / エラー時もサムネイル表示**: 取り込み開始直後 (loading) や
  EXIF 解析失敗時 (error) でも、いま処理対象になっている画像のサムネイル + ファイル名 /
  サイズ を表示。これにより「どの画像が指定されているのかわからない」という UX
  問題を解消した。新規 reducer アクション `BLOB_LOADED` で blob のみ先行確定する設計。
- **ローディング表示を改善**: 「解析中…」のみだった表示を、フェーズ別 (取得中 / 検証中 /
  EXIF 読取中) + lucide スピナーアニメーションへ変更。
- **DropZone と header の視覚改善**: lucide アイコン (Upload / Link2 / RotateCcw)
  + ヘッダーへの拡張アイコン表示 + drag-over 時のアニメーション + ホバー色強調。

### Added
- `src/utils/error-display.ts` — エラーコード → UI 表示情報マッピングの純粋関数
- `src/utils/format-size.ts` — バイト数 / 寸法を人間可読に整形する純粋関数
- `src/ui/components/ErrorPanel.tsx` — 構造化エラー表示コンポーネント
- `src/ui/components/ImageSummary.tsx` — 画像サマリ + サムネイル表示 (summary 任意化済み)
- `src/ui/components/LoadingIndicator.tsx` — フェーズ別ローディング表示
- 41 件の i18n キー追加 (en/ja 両言語)

## [0.1.3] - 2026-05-08

### Fixed
- URL から画像を取得した際に CORS エラー (`Access to fetch at '<URL>' from origin
  'chrome-extension://...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin'
  header is present`) で取得が失敗する問題を修正。
  Manifest V3 では Background SW からの fetch でも、対象ホストの `host_permissions`
  を持っていないと CORS 制約が適用される。`optional_host_permissions` のままでは
  ユーザー同意が取られていないため事実上無効状態になっていた。
- `host_permissions: ['*://*/*']` (http/https 任意ホスト) を **required** に昇格。
  既存ユーザーは権限再承認が必要 (Chrome の拡張管理ページで「権限を承認」ボタンが表示される)。

### Changed
- `optional_host_permissions: ['<all_urls>']` を削除し、`host_permissions: ['*://*/*']`
  に置換。`*://*/*` は http/https のみを許可し、`<all_urls>` (file:// 等を含む) より
  狭く制限。

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
