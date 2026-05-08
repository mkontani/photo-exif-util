/**
 * dist/ を photo-exif-util-v<VERSION>.zip にパッケージングするスクリプト。
 * fflate を使用して ZIP を生成する。
 *
 * 使い方: pnpm pack:zip
 * 前提: pnpm build で dist/ が生成済みであること。
 *
 * バージョンは src/manifest.config.ts から regex で抽出する。
 * (release.yml の version 抽出ロジックと整合)
 */
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const DIST_DIR = 'dist';
const MANIFEST_CONFIG = 'src/manifest.config.ts';
const OUTPUT_NAME_PREFIX = 'photo-exif-util';

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

/**
 * manifest.config.ts のテキストから semver の version 値を抽出する純粋関数。
 *  - シングル/ダブルクォート両対応
 *  - 最初に出現する `version: '...'` を採用 (commands.suggested_key より上にある前提)
 *  - 見つからない / 不正フォーマット時は throw
 */
export function extractManifestVersion(source: string): string {
  const match = source.match(/version:\s*['"]([0-9]+\.[0-9]+\.[0-9]+)['"]/);
  if (!match) {
    throw new Error('Could not extract semver version from manifest source');
  }
  return match[1];
}

/**
 * バージョンから出力 ZIP ファイル名を組み立てる純粋関数。
 * 例: 0.2.3 → photo-exif-util-v0.2.3.zip
 */
export function buildOutputZipName(version: string): string {
  return `${OUTPUT_NAME_PREFIX}-v${version}.zip`;
}

/** manifest.config.ts を読み取って version を返すヘルパ。テストはモック化容易にするため fs と分離。 */
async function readManifestVersion(manifestPath: string): Promise<string> {
  const source = await readFile(manifestPath, 'utf8');
  return extractManifestVersion(source);
}

async function main(): Promise<void> {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`${DIST_DIR}/ が存在しません。先に \`pnpm build\` を実行してください`);
  }

  const version = await readManifestVersion(MANIFEST_CONFIG);
  const outputZip = buildOutputZipName(version);

  const allFiles = await readDirRecursive(DIST_DIR);
  // 不要ファイル (.vite/manifest.json、.gitkeep) を除外して提出物の純度を保つ
  const files = allFiles.filter((f) => {
    const rel = relative(DIST_DIR, f).replaceAll('\\', '/');
    return !shouldExcludeFromZip(rel);
  });
  const zipEntries = await buildZipEntries(DIST_DIR, files);

  const zipped = zipSync(zipEntries, { level: 9 });
  await writeFile(outputZip, zipped);
  console.log(`Wrote ${outputZip} (${zipped.length} bytes, ${files.length} files)`);
}

// このファイルが直接実行されたときだけ main() を呼ぶ。
// テストでインポートしたときは実行しない。
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
