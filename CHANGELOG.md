# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
