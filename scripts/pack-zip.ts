/**
 * dist/ を chrome-extension.zip にパッケージングするスクリプト。
 * fflate を使用して ZIP を生成する。
 *
 * 使い方: pnpm pack:zip
 * 前提: pnpm build で dist/ が生成済みであること。
 */
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const DIST_DIR = 'dist';
const OUTPUT_ZIP = 'chrome-extension.zip';

/**
 * ディレクトリを再帰的にたどってファイルパスの一覧を返す。
 * テスト可能にするため export する。
 */
export async function readDirRecursive(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await readDirRecursive(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * ファイルパスのリストから ZIP エントリ用の Record を構築する。
 * キーは baseDir からの相対パス (スラッシュ区切り)。
 * テスト可能にするため export する。
 */
export async function buildZipEntries(
  baseDir: string,
  files: readonly string[],
): Promise<Record<string, Uint8Array>> {
  const entries: Record<string, Uint8Array> = {};
  for (const filePath of files) {
    const relPath = relative(baseDir, filePath).replaceAll('\\', '/');
    entries[relPath] = new Uint8Array(await readFile(filePath));
  }
  return entries;
}

/**
 * Web Store 提出物に含めるべきでないファイルかを判定する純粋関数。
 *  - `.vite/` (Vite ビルドメタデータ): 内部情報のため除外
 *  - `.gitkeep` (git ディレクトリ保持用): 拡張ランタイムで不要
 */
export function shouldExcludeFromZip(relPath: string): boolean {
  if (relPath.startsWith('.vite/') || relPath.startsWith('.vite\\')) return true;
  if (relPath.endsWith('/.gitkeep') || relPath.endsWith('\\.gitkeep') || relPath === '.gitkeep') {
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`${DIST_DIR}/ が存在しません。先に \`pnpm build\` を実行してください`);
  }

  const allFiles = await readDirRecursive(DIST_DIR);
  // 不要ファイル (.vite/manifest.json、.gitkeep) を除外して提出物の純度を保つ
  const files = allFiles.filter((f) => {
    const rel = relative(DIST_DIR, f).replaceAll('\\', '/');
    return !shouldExcludeFromZip(rel);
  });
  const zipEntries = await buildZipEntries(DIST_DIR, files);

  const zipped = zipSync(zipEntries, { level: 9 });
  await writeFile(OUTPUT_ZIP, zipped);
  console.log(`Wrote ${OUTPUT_ZIP} (${zipped.length} bytes, ${files.length} files)`);
}

// このファイルが直接実行されたときだけ main() を呼ぶ。
// テストでインポートしたときは実行しない。
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
