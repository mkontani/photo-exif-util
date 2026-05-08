import { createContextMenuEntry, registerContextMenuListener } from '@/background/context-menu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Service Worker ライフサイクル耐性のテスト。
 *
 * 主目的: `chrome.contextMenus.onClicked` リスナーが
 * `chrome.runtime.onInstalled` の発火を待たずに登録されることを保証する。
 * SW がアイドルで終了 → イベントで再起動した場合、トップレベルコードのみが
 * 再実行されるため、リスナー登録もトップレベルで行わなければクリックが失われる。
 */

type ClickedHandler = (
  info: chrome.contextMenus.OnClickedData,
  tab: chrome.tabs.Tab | undefined,
) => void;

interface ChromeMock {
  contextMenus: {
    create: ReturnType<typeof vi.fn>;
    onClicked: {
      addListener: ReturnType<typeof vi.fn>;
      _handlers: ClickedHandler[];
    };
  };
  i18n: { getMessage: ReturnType<typeof vi.fn> };
  sidePanel: { open: ReturnType<typeof vi.fn> };
  storage: { session: { set: ReturnType<typeof vi.fn> } };
  runtime: { id: string };
}

let chromeMock: ChromeMock;

beforeEach(() => {
  const handlers: ClickedHandler[] = [];
  chromeMock = {
    contextMenus: {
      create: vi.fn(),
      onClicked: {
        addListener: vi.fn((handler: ClickedHandler) => {
          handlers.push(handler);
        }),
        _handlers: handlers,
      },
    },
    i18n: {
      getMessage: vi.fn(() => 'Photo EXIF Util で開く'),
    },
    sidePanel: {
      open: vi.fn(() => Promise.resolve()),
    },
    storage: {
      session: {
        set: vi.fn(() => Promise.resolve()),
      },
    },
    runtime: { id: 'test-extension-id' },
  };
  // @ts-expect-error テスト用 chrome グローバルの注入
  globalThis.chrome = chromeMock;
});

afterEach(() => {
  // @ts-expect-error クリーンアップ
  globalThis.chrome = undefined;
  vi.restoreAllMocks();
});

describe('registerContextMenuListener', () => {
  it('onInstalled に依存せず onClicked リスナーを即座に登録する', () => {
    registerContextMenuListener();
    expect(chromeMock.contextMenus.onClicked.addListener).toHaveBeenCalledTimes(1);
    expect(chromeMock.contextMenus.onClicked._handlers).toHaveLength(1);
  });

  it('listener 登録時に contextMenus.create は呼ばない (重複作成防止)', () => {
    registerContextMenuListener();
    expect(chromeMock.contextMenus.create).not.toHaveBeenCalled();
  });

  it('クリック時: 自メニュー以外は無視', () => {
    registerContextMenuListener();
    const handler = chromeMock.contextMenus.onClicked._handlers[0];
    if (!handler) throw new Error('handler not registered');

    handler(
      {
        menuItemId: 'other-menu',
        srcUrl: 'https://example.com/x.jpg',
        editable: false,
        pageUrl: 'https://example.com',
      } as chrome.contextMenus.OnClickedData,
      { id: 1 } as chrome.tabs.Tab,
    );

    expect(chromeMock.sidePanel.open).not.toHaveBeenCalled();
    expect(chromeMock.storage.session.set).not.toHaveBeenCalled();
  });

  it('クリック時: srcUrl 未指定なら無視', () => {
    registerContextMenuListener();
    const handler = chromeMock.contextMenus.onClicked._handlers[0];
    if (!handler) throw new Error('handler not registered');

    handler(
      {
        menuItemId: 'photo-exif-util-open',
        editable: false,
        pageUrl: 'https://example.com',
      } as chrome.contextMenus.OnClickedData,
      { id: 1 } as chrome.tabs.Tab,
    );

    expect(chromeMock.sidePanel.open).not.toHaveBeenCalled();
    expect(chromeMock.storage.session.set).not.toHaveBeenCalled();
  });

  it('クリック時: 不正な URL (private IP) はバリデーションで弾く', () => {
    registerContextMenuListener();
    const handler = chromeMock.contextMenus.onClicked._handlers[0];
    if (!handler) throw new Error('handler not registered');

    handler(
      {
        menuItemId: 'photo-exif-util-open',
        srcUrl: 'http://192.168.1.1/x.jpg',
        editable: false,
        pageUrl: 'https://example.com',
      } as chrome.contextMenus.OnClickedData,
      { id: 1 } as chrome.tabs.Tab,
    );

    expect(chromeMock.sidePanel.open).not.toHaveBeenCalled();
    expect(chromeMock.storage.session.set).not.toHaveBeenCalled();
  });

  it('クリック時: 正常パスは sidePanel.open を同期的に呼んでから storage.session.set', () => {
    registerContextMenuListener();
    const handler = chromeMock.contextMenus.onClicked._handlers[0];
    if (!handler) throw new Error('handler not registered');

    handler(
      {
        menuItemId: 'photo-exif-util-open',
        srcUrl: 'https://example.com/photo.jpg',
        editable: false,
        pageUrl: 'https://example.com',
      } as chrome.contextMenus.OnClickedData,
      { id: 42 } as chrome.tabs.Tab,
    );

    // user gesture を保つため sidePanel.open は同期的に呼ばれる必要がある
    expect(chromeMock.sidePanel.open).toHaveBeenCalledWith({ tabId: 42 });
    expect(chromeMock.storage.session.set).toHaveBeenCalledWith({
      pendingIngest: expect.objectContaining({
        srcUrl: 'https://example.com/photo.jpg',
        ts: expect.any(Number),
      }),
    });
    // 呼び出し順: open が set より先 (user gesture コンテキスト保持のため)
    const openOrder = chromeMock.sidePanel.open.mock.invocationCallOrder[0];
    const setOrder = chromeMock.storage.session.set.mock.invocationCallOrder[0];
    expect(openOrder).toBeLessThan(setOrder ?? Number.POSITIVE_INFINITY);
  });

  it('クリック時: tab.id が未定義なら sidePanel.open は呼ばない', () => {
    registerContextMenuListener();
    const handler = chromeMock.contextMenus.onClicked._handlers[0];
    if (!handler) throw new Error('handler not registered');

    handler(
      {
        menuItemId: 'photo-exif-util-open',
        srcUrl: 'https://example.com/photo.jpg',
        editable: false,
        pageUrl: 'https://example.com',
      } as chrome.contextMenus.OnClickedData,
      undefined,
    );

    expect(chromeMock.sidePanel.open).not.toHaveBeenCalled();
    // storage は書き込む (Side Panel が後から開かれた場合に拾えるよう)
    expect(chromeMock.storage.session.set).toHaveBeenCalled();
  });
});

describe('createContextMenuEntry', () => {
  it('contextMenus.create を 1 回だけ呼ぶ', () => {
    createContextMenuEntry();
    expect(chromeMock.contextMenus.create).toHaveBeenCalledTimes(1);
    expect(chromeMock.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'photo-exif-util-open',
        contexts: ['image'],
      }),
    );
  });

  it('リスナーは登録しない (onInstalled の中で呼ばれるため、SW 再起動時には呼ばれない)', () => {
    createContextMenuEntry();
    expect(chromeMock.contextMenus.onClicked.addListener).not.toHaveBeenCalled();
  });
});
