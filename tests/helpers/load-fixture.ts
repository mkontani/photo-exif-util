/**
 * テスト用フィクスチャ画像を読み込むヘルパー。
 * キャッシュが存在すればそれを返し、なければ build-fixtures で生成してから返す。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAllFixtures } from './build-fixtures';

const FIXTURES_CACHE_DIR = join(import.meta.dirname, '../fixtures/.cache');

/**
 * フィクスチャ名から Blob を返す。
 * @param name - 例: 'jpeg-with-gps.jpg'
 */
export function loadFixtureAsBlob(name: string): Blob {
  const path = join(FIXTURES_CACHE_DIR, name);
  if (!existsSync(path)) {
    buildAllFixtures();
  }
  const buffer = readFileSync(path);
  return new Blob([buffer], { type: mimeTypeOf(name) });
}

/**
 * フィクスチャ名から ArrayBuffer を返す。
 */
export function loadFixtureAsArrayBuffer(name: string): ArrayBuffer {
  const path = join(FIXTURES_CACHE_DIR, name);
  if (!existsSync(path)) {
    buildAllFixtures();
  }
  const buffer = readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * フィクスチャ名から Uint8Array を返す。
 */
export function loadFixtureAsUint8Array(name: string): Uint8Array {
  const path = join(FIXTURES_CACHE_DIR, name);
  if (!existsSync(path)) {
    buildAllFixtures();
  }
  return readFileSync(path);
}

function mimeTypeOf(name: string): string {
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}
