import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  version: '0.1.3',
  minimum_chrome_version: '116',
  permissions: ['contextMenus', 'sidePanel', 'storage'],
  // host_permissions を required で宣言する。
  // 理由: MV3 では Background SW からの fetch でも、対象ホストの host_permissions を
  // 持っていないと CORS 制約が適用される。URL からの画像取得は本拡張のコア機能のため、
  // optional ではなく required で宣言してインストール時に同意を取る方が UX が良い。
  // PRIVACY.md の justification: 「ユーザーが入力した URL から画像を取得するためのみ
  // に使用し、Background Service Worker 経由で fetch、コンテンツスクリプトから直接
  // アクセスしない」を Web Store 提出時に登録する。
  host_permissions: ['*://*/*'],
  // MV3 CSP: script-src / object-src を 'self' に限定。
  // style-src 'unsafe-inline' は Tailwind v4 のインラインスタイル出力に必須。
  // img-src に blob: / data: を含めるのは Blob URL / Data URL のプレビュー表示に必要。
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'",
  },
  // キーボードショートカット: Ctrl+Shift+E でサイドパネルを開く
  commands: {
    'open-side-panel': {
      suggested_key: {
        default: 'Ctrl+Shift+E',
        mac: 'Command+Shift+E',
      },
      description: '__MSG_commandOpenSidePanel__',
    },
  },
  action: {
    default_popup: 'src/ui/popup/index.html',
  },
  side_panel: {
    default_path: 'src/ui/side-panel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'src/ui/options/index.html',
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
});
