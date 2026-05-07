# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
