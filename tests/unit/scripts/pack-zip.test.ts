/**
 * pack-zip スクリプトのユニットテスト。
 * 純粋関数 (readDirRecursive, buildZipEntries) をテストする。
 * fflate の zipSync 自体はテスト不要 (サードパーティ) なので、
 * "ファイル一覧収集" と "エントリマップ生成" ロジックを検証する。
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// テスト対象: scripts/pack-zip.ts から純粋関数をエクスポートして使う
import { buildZipEntries, readDirRecursive, shouldExcludeFromZip } from '../../../scripts/pack-zip';

describe('readDirRecursive', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pack-zip-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('空ディレクトリで空配列を返す', async () => {
    const files = await readDirRecursive(tmpDir);
    expect(files).toEqual([]);
  });

  it('フラットなファイルを全て列挙する', async () => {
    await writeFile(join(tmpDir, 'a.js'), 'a');
    await writeFile(join(tmpDir, 'b.json'), '{}');
    const files = await readDirRecursive(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.replace(`${tmpDir}/`, ''))).toEqual(
      expect.arrayContaining(['a.js', 'b.json']),
    );
  });

  it('ネストしたディレクトリを再帰的に列挙する', async () => {
    await mkdir(join(tmpDir, 'sub'), { recursive: true });
    await writeFile(join(tmpDir, 'root.txt'), 'root');
    await writeFile(join(tmpDir, 'sub', 'deep.txt'), 'deep');
    const files = await readDirRecursive(tmpDir);
    expect(files).toHaveLength(2);
  });

  it('3 階層のネストでも全ファイルを列挙する', async () => {
    await mkdir(join(tmpDir, 'a', 'b', 'c'), { recursive: true });
    await writeFile(join(tmpDir, 'top.js'), '');
    await writeFile(join(tmpDir, 'a', 'mid.js'), '');
    await writeFile(join(tmpDir, 'a', 'b', 'c', 'deep.js'), '');
    const files = await readDirRecursive(tmpDir);
    expect(files).toHaveLength(3);
  });
});

describe('buildZipEntries', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pack-zip-entries-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('ファイルパスを dist/ からの相対パスをキーにした Record を返す', async () => {
    await writeFile(join(tmpDir, 'manifest.json'), '{"v":3}');
    const files = [join(tmpDir, 'manifest.json')];
    const entries = await buildZipEntries(tmpDir, files);
    expect(Object.keys(entries)).toEqual(['manifest.json']);
    expect(entries['manifest.json']).toBeInstanceOf(Uint8Array);
  });

  it('サブディレクトリのファイルはスラッシュ区切りのパスをキーにする', async () => {
    await mkdir(join(tmpDir, 'assets'), { recursive: true });
    await writeFile(join(tmpDir, 'assets', 'icon.png'), 'PNG');
    const files = [join(tmpDir, 'assets', 'icon.png')];
    const entries = await buildZipEntries(tmpDir, files);
    expect(Object.keys(entries)).toEqual(['assets/icon.png']);
  });

  it('Windows スタイルのバックスラッシュをスラッシュに変換する', async () => {
    // Windows パスシミュレーション: replaceAll('\\', '/') の動作確認
    await writeFile(join(tmpDir, 'file.txt'), 'content');
    const files = [join(tmpDir, 'file.txt')];
    const entries = await buildZipEntries(tmpDir, files);
    const keys = Object.keys(entries);
    expect(keys.every((k) => !k.includes('\\'))).toBe(true);
  });

  it('空のファイルも Uint8Array として含める', async () => {
    await writeFile(join(tmpDir, 'empty.txt'), '');
    const files = [join(tmpDir, 'empty.txt')];
    const entries = await buildZipEntries(tmpDir, files);
    expect(entries['empty.txt']).toBeInstanceOf(Uint8Array);
    expect(entries['empty.txt'].length).toBe(0);
  });

  it('ファイル内容を正しく Uint8Array に変換する', async () => {
    const content = 'Hello, World!';
    await writeFile(join(tmpDir, 'hello.txt'), content);
    const files = [join(tmpDir, 'hello.txt')];
    const entries = await buildZipEntries(tmpDir, files);
    const decoded = new TextDecoder().decode(entries['hello.txt']);
    expect(decoded).toBe(content);
  });
});

describe('buildZipEntries - 複数ファイル', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pack-zip-multi-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('複数ファイルを一度にエントリマップに含める', async () => {
    await mkdir(join(tmpDir, 'icons'), { recursive: true });
    await writeFile(join(tmpDir, 'manifest.json'), '{}');
    await writeFile(join(tmpDir, 'icons', 'icon-16.png'), 'PNG16');
    await writeFile(join(tmpDir, 'icons', 'icon-48.png'), 'PNG48');
    const files = await readDirRecursive(tmpDir);
    const entries = await buildZipEntries(tmpDir, files);
    expect(Object.keys(entries)).toHaveLength(3);
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining(['manifest.json', 'icons/icon-16.png', 'icons/icon-48.png']),
    );
  });
});

describe('shouldExcludeFromZip', () => {
  it('.vite/ 配下は除外', () => {
    expect(shouldExcludeFromZip('.vite/manifest.json')).toBe(true);
    expect(shouldExcludeFromZip('.vite/deps/foo.js')).toBe(true);
  });

  it('.gitkeep は除外', () => {
    expect(shouldExcludeFromZip('.gitkeep')).toBe(true);
    expect(shouldExcludeFromZip('icons/.gitkeep')).toBe(true);
    expect(shouldExcludeFromZip('public/icons/.gitkeep')).toBe(true);
  });

  it('通常のファイルは含める', () => {
    expect(shouldExcludeFromZip('manifest.json')).toBe(false);
    expect(shouldExcludeFromZip('icons/icon-16.png')).toBe(false);
    expect(shouldExcludeFromZip('assets/index.js')).toBe(false);
    expect(shouldExcludeFromZip('_locales/en/messages.json')).toBe(false);
  });
});
