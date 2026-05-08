# Chrome Web Store Listing — Photo EXIF Util

Dashboard 貼り付け用テキスト集。各セクションは **EN → JA** の順。
Web Store 側の文字数制限を `(N / max)` 形式で併記している。
そのまま [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) のフォームへコピペできる。

提出時 ZIP: [`photo-exif-util-v0.2.4.zip`](https://github.com/mkontani/photo-exif-util/releases/download/v0.2.4/photo-exif-util-v0.2.4.zip)

---

## 1. Item name (≤ 45 chars)

**EN** `(16/45)`

```
Photo EXIF Util
```

**JA** `(16/45)`

```
Photo EXIF Util
```

> 同名で問題なし。日本語名にしたい場合は「Photo EXIF Util — 写真メタデータ整理」(28/45) なども可。

---

## 2. Summary / 概要 (≤ 132 chars)

**EN** `(127/132)`

```
View, analyze, and strip EXIF from JPEG / PNG / WebP images, then resize for 11 SNS presets — fully client-side, no uploads.
```

**JA** `(127/132 — 日本語は文字数換算で半分扱いだが安全側で 132 制限を守る)`

```
JPEG / PNG / WebP の EXIF を表示・分析・削除し、11 種の SNS プリセットに合わせてリサイズ。完全クライアントサイドで動作し、画像は端末外に送信しません。
```

---

## 3. Description / 詳細説明 (≤ 16,000 chars)

### EN

```
Photo EXIF Util is a privacy-first Chrome extension that lets you inspect,
strip, and optimize image metadata entirely on your own device. No image
bytes, EXIF fields, or analytics are ever sent to a server.

WHY USE IT
- Photos taken on smartphones and modern cameras embed location, device
  serial numbers, lens IDs, and timestamps in EXIF metadata. Sharing such
  images on social platforms can expose your home, daily routine, or
  equipment.
- Built-in OS tools strip metadata silently and indiscriminately.
  Photo EXIF Util shows you exactly what is there, why it matters, and
  lets you remove only what you choose.

THREE TABS

1. Inspect
   Drop a JPEG / PNG / WebP file or paste an image URL. The side panel
   reveals every EXIF field with a privacy-risk badge (High / Medium /
   Low / None). A search box and category filter help you scan large tag
   sets quickly. GPS presence and "highest risk" are surfaced at the top.

2. Strip
   Choose categories to remove (GPS, Device, Lens, Capture settings,
   Date / Time, Software, Orientation). ICC color profiles can be kept
   to preserve color accuracy. The cleaned image is regenerated locally
   and offered as a download.

3. Optimize
   Resize and re-encode for SNS targets — 11 presets cover X (Twitter)
   Post / Card, Instagram Square / Portrait / Story, Threads, LINE Talk
   / Timeline, Bluesky, Facebook, plus a Custom mode. Quality is
   adjustable, and the tool searches for the highest quality that still
   meets the platform's file-size cap.

PRIVACY GUARANTEE
- Pure client-side processing using OffscreenCanvas, the Web Crypto API,
  and pica for resizing. No external services involved.
- Network requests happen only when you explicitly type / right-click a
  URL. Drag-and-drop and the file picker never touch the network.
- All Background Service Worker fetches use `redirect: 'manual'` and
  reject requests to private / loopback / link-local IP addresses to
  prevent SSRF.
- Content Security Policy locks `script-src` and `object-src` to
  `'self'`. No remote code execution.
- Open source on GitHub. Reproducible builds: see the repository.

ACCESSIBILITY & UX
- Light / Dark / system-preference theme.
- Localized in English and Japanese (chrome.i18n).
- WAI-ARIA tab pattern, keyboard-navigable side panel.
- Keyboard shortcut Ctrl+Shift+E (⌘+Shift+E on macOS) to open.

SUPPORTED FORMATS
JPEG, PNG, WebP. Files up to 50 MB.

OPEN SOURCE
github.com/mkontani/photo-exif-util — MIT-licensed.
```

### JA

```
Photo EXIF Util は、画像メタデータを完全に端末内で確認・削除・最適化できる
プライバシー優先の Chrome 拡張です。画像バイト・EXIF フィールド・利用統計のいずれも、
サーバーに送信されることはありません。

なぜ必要か
- スマートフォンや一眼カメラで撮影した写真には、撮影場所 (GPS)、機種・シリアル
  番号、レンズ ID、日時などが EXIF として埋め込まれます。SNS にそのまま投稿すると、
  自宅・行動圏・所有機材が他人に推測されるリスクがあります。
- OS 標準のメタデータ削除機能は「全部消す」処理が多く、不可逆かつ何が消えたかが
  分かりません。本拡張は「いま何が入っているか」を見える化し、必要なカテゴリだけ
  選んで削除できます。

3 つのタブ

1. 検査 (Inspect)
   JPEG / PNG / WebP のファイル、または画像 URL を入力すると、サイドパネルに
   EXIF フィールドが一覧表示され、各項目に「高 / 中 / 低 / なし」のリスクバッジが
   付きます。検索ボックスとカテゴリフィルタで大量タグを絞り込めます。GPS 有無と
   最高リスクは画面上部に明示されます。

2. 削除 (Strip)
   削除するカテゴリ (GPS / デバイス / レンズ / 撮影設定 / 日時 / ソフトウェア /
   向き) を選んで実行します。ICC カラープロファイルは保持できるため、色再現を
   損なわずに個人情報のみ除去できます。出力画像はローカル生成され、そのまま
   ダウンロードできます。

3. 最適化 (Optimize)
   SNS 向けにリサイズ + 再エンコードします。11 種のプリセット —
   X (Twitter) Post / Card、Instagram Square / Portrait / Story、Threads、
   LINE Talk / Timeline、Bluesky、Facebook、+ Custom — を用意。品質は手動調整可で、
   プラットフォームのファイルサイズ上限に収まる最高品質を自動探索します。

プライバシー保証
- OffscreenCanvas / Web Crypto / pica を用いた純粋なクライアントサイド処理。
  外部サービスを一切使いません。
- ネットワーク通信は、ユーザーが URL を明示入力したときと、右クリックメニューで
  画像を渡したときのみ発生します。ドラッグ&ドロップとファイル選択ではネットワークに
  一切アクセスしません。
- Background Service Worker の fetch は `redirect: 'manual'` を強制し、プライベート
  IP・ループバック・リンクローカル宛は拒否することで SSRF を防いでいます。
- Content Security Policy で `script-src` / `object-src` を `'self'` に制限。
  リモートコードは実行しません。
- ソースは GitHub で公開しており、ビルドの再現が可能です。

アクセシビリティと UX
- ライト / ダーク / システム連動の 3 テーマ
- 英語・日本語の i18n 対応 (chrome.i18n)
- WAI-ARIA Tabs パターンに準拠、キーボード操作可
- Ctrl+Shift+E (macOS は ⌘+Shift+E) でサイドパネルを開く

対応フォーマット
JPEG / PNG / WebP、最大 50 MB

オープンソース
github.com/mkontani/photo-exif-util — MIT ライセンス
```

---

## 4. Single purpose / 単一目的

**EN** `(≤ 1000 chars; 232 used)`

```
Locally inspect EXIF metadata of JPEG / PNG / WebP images, allow the user
to remove sensitive fields (GPS, device serial, timestamps), and optionally
re-encode the image for common social-media size and dimension presets.
All processing happens client-side; no image leaves the device.
```

**JA** `(≤ 1000 chars; 169 used)`

```
JPEG / PNG / WebP 画像の EXIF メタデータを端末内で確認し、機密フィールド
(GPS / 機種シリアル / 日時など) をユーザーが選んで削除できるようにし、
必要に応じて主要 SNS のサイズ / 寸法プリセットに合わせて再エンコードする。
全処理は端末内で完結し、画像は外部に送信されない。
```

---

## 5. Permission justifications / 権限の正当化

> Web Store では各 permission ごとに individual justification 欄がある。
> 以下を該当欄にそのまま貼る。

### 5.1 `host_permissions: ["*://*/*"]`

**EN**

```
Required to fetch image bytes from user-supplied URLs (typed manually
into the side panel input or selected via the right-click context menu)
so that EXIF analysis can be performed locally in the browser. Manifest
V3 enforces CORS on Background Service Worker fetch calls unless the
extension holds host permissions for the target origin, which is why
this permission is required (not optional).

The permission is used only when the user explicitly enters a URL or
activates the right-click context menu on an image. It is never used
for passive monitoring, background polling, or analytics. All fetches
happen through the Background Service Worker; content scripts never
receive this permission. Local files (drag-and-drop / file picker) do
not perform any network request and are not affected by this
permission.
```

**JA**

```
ユーザーが入力した URL、または右クリックメニューで選択された画像 URL から
画像バイトを取得し、ブラウザ内で EXIF 解析を実行するために必要です。
Manifest V3 では Background Service Worker の fetch にも CORS 制約が
適用されるため、対象オリジンの host_permissions を保持していない限り
クロスオリジン取得ができません。よって optional ではなく required で
宣言しています。

この権限を使うのは、ユーザーがサイドパネルに URL を入力したとき、または
画像を右クリックしてコンテキストメニューを起動したときのみです。
受動的な監視・バックグラウンドのポーリング・利用統計などには一切使いません。
fetch は Background Service Worker 経由で実行され、コンテンツスクリプトに
この権限が渡されることはありません。ローカルファイル (ドラッグ&ドロップ /
ファイル選択) はネットワークにアクセスしないため、本権限の影響を受けません。
```

### 5.2 `contextMenus`

**EN**

```
Adds an "Open with Photo EXIF Util" item to the right-click menu when
the user right-clicks an image. Selecting it opens the side panel and
hands the image URL off to the inspect pipeline. No menu items are
shown for non-image targets.
```

**JA**

```
画像を右クリックしたときに「Photo EXIF Util で開く」メニュー項目を追加します。
これを選択するとサイドパネルが開き、画像 URL が検査パイプラインに渡されます。
画像以外の要素を右クリックしてもメニューには表示されません。
```

### 5.3 `sidePanel`

**EN**

```
The extension's main UI is a Chrome Side Panel (Chrome 116+). All
inspection, stripping, and optimization happens in this panel rather
than a separate tab or popup, so the user can keep the source page
visible side-by-side. The action icon and Ctrl+Shift+E open the
panel for the active tab.
```

**JA**

```
本拡張のメイン UI は Chrome Side Panel (Chrome 116+) です。
検査・削除・最適化のすべてをサイドパネル内で行うため、参照元のページを
横に並べたまま操作できます。ツールバーアイコン、または Ctrl+Shift+E で
アクティブタブのサイドパネルを開きます。
```

### 5.4 `storage`

**EN**

```
Persists user preferences in chrome.storage.local: default SNS profile
selection and theme (auto / light / dark). No image data, EXIF
contents, or PII is ever stored. The right-click context-menu hand-off
uses chrome.storage.session, which is cleared automatically when the
browser closes.
```

**JA**

```
ユーザー設定 (デフォルト SNS プロファイル、テーマ: auto / light / dark) を
chrome.storage.local に保存します。画像データ・EXIF 内容・個人情報は
一切保存しません。右クリックメニューからの URL 受け渡しは
chrome.storage.session を使い、ブラウザを閉じると自動的にクリアされます。
```

---

## 6. Privacy practices / プライバシー実務 (Dashboard チェックボックス対応)

| 質問 | 回答 |
|---|---|
| Personally identifiable information を収集するか | **No** |
| Health information を収集するか | **No** |
| Financial / payment information を収集するか | **No** |
| Authentication information を収集するか | **No** |
| Personal communications を収集するか | **No** |
| Location データを収集するか | **No** |
| Web history を収集するか | **No** |
| User activity を収集するか | **No** |
| Website content を収集するか | **No** |
| 収集したデータをサードパーティに販売するか | **No** (収集していない) |
| 収集したデータを本拡張のコア機能と無関係な目的に使うか | **No** (収集していない) |
| ユーザー・チェック信用評価などに使うか | **No** (収集していない) |
| Remote code execution を行うか | **No** |

**Privacy Policy URL**

```
https://mkontani.github.io/photo-exif-util/PRIVACY
```

> 配信元: GitHub Pages (source: `main` / `/docs`)。canonical は `docs/PRIVACY.md`。
> 内容を更新したら `docs/PRIVACY.md` を編集 → main にマージで自動再デプロイ。

---

## 7. Distribution / Visibility

- **Visibility**: Public
- **Geographic distribution**: All regions (絞る理由なし)
- **Pricing**: Free
- **Mature content**: No

---

## 8. Reviewer notes (任意 — Web Store の "追加情報" 欄に貼ると審査が早い)

**EN**

```
Source code: https://github.com/mkontani/photo-exif-util (MIT)
Build: pnpm install --frozen-lockfile && pnpm build && pnpm pack:zip
The ZIP submitted is photo-exif-util-v0.2.4.zip from the v0.2.4
GitHub Release. SHA-256 of the asset is documented in the release
notes.

Network requests are limited to user-initiated image fetches (URL
input or right-click context menu) and are subject to SSRF defenses
(URL validator at src/core/ingest/url-validator.ts, Background SW
redirect: 'manual', private-IP and loopback rejection).

No remote code, no eval, no analytics. CSP locks script-src to 'self'.
```

**JA**

```
ソースコード: https://github.com/mkontani/photo-exif-util (MIT)
ビルド: pnpm install --frozen-lockfile && pnpm build && pnpm pack:zip
提出 ZIP は v0.2.4 GitHub Release の photo-exif-util-v0.2.4.zip。
アセットの SHA-256 は Release ノートに記載。

ネットワーク通信は、ユーザーが起動した画像取得 (URL 入力 / 右クリック
メニュー) のみで、SSRF 対策 (URL バリデータ src/core/ingest/url-validator.ts、
Background SW の redirect: 'manual'、プライベート IP・ループバック拒否) を
通過します。

リモートコード・eval・利用統計は一切ありません。CSP で script-src を 'self' に
制限しています。
```

---

## 9. アップロード手順チェックリスト

- [ ] [Developer Dashboard](https://chrome.google.com/webstore/devconsole) にログイン (未登録なら $5 払う)
- [ ] 「新しいアイテム」→ ZIP アップロード → [photo-exif-util-v0.2.4.zip](https://github.com/mkontani/photo-exif-util/releases/download/v0.2.4/photo-exif-util-v0.2.4.zip)
- [ ] **ストアの掲載情報** タブ
  - [ ] 言語: 既定を English (EN)、追加で Japanese (JA)
  - [ ] アイテム名: §1 から貼り付け
  - [ ] 概要: §2 から貼り付け
  - [ ] 説明: §3 から貼り付け
  - [ ] スクリーンショット: `assets/promos/screenshot0[1-4].png` を 4 枚
  - [ ] 小タイル: `assets/promos/promo-small.png`
  - [ ] アイコン 128: `public/icons/icon-128.png`
  - [ ] カテゴリ: 「ツール」 (Tools) を推奨。「写真」(Photos) も可
- [ ] **プライバシー** タブ: §6 の通りチェック → Privacy Policy URL を入力
- [ ] **権限** タブ: §5 の各文言を該当欄に貼り付け
- [ ] **配布** タブ: §7
- [ ] 「追加情報」: §8 を貼り付け
- [ ] 「単一目的」: §4 を貼り付け
- [ ] 提出 → 審査待ち (通常 1〜3 営業日)

---

## 10. メンテナンス時の注意

- 本ファイルはストア審査用の「現行 v0.2.4 版」を反映している。次回バージョンで
  説明文や権限が変わる場合、本ファイルも一緒に更新してから提出する。
- バージョン番号 (`v0.2.4` / `photo-exif-util-v0.2.4.zip`) は本ファイル内に
  ハードコードされている。`grep -n 'v0\.' docs/STORE_LISTING.md` で要更新箇所を
  確認できる。
- Privacy Policy URL は外部ホストの問題で変わりやすいので、§6 の URL を最新化する。
