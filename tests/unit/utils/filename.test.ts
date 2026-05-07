import { safeFilename, splitExtension, uniqueFilename } from '@/utils/filename';
import { describe, expect, it } from 'vitest';

describe('safeFilename', () => {
  it('パス区切り / を _ に置換する', () => {
    expect(safeFilename('a/b.jpg')).toBe('a_b.jpg');
  });

  it('バックスラッシュを _ に置換する', () => {
    expect(safeFilename('a\\b.jpg')).toBe('a_b.jpg');
  });

  it('コロンを _ に置換する', () => {
    expect(safeFilename('a:b.jpg')).toBe('a_b.jpg');
  });

  it('複合パス区切りをすべて _ に置換する', () => {
    expect(safeFilename('a:b\\c.jpg')).toBe('a_b_c.jpg');
  });

  it('空文字列は image を返す', () => {
    expect(safeFilename('')).toBe('image');
  });

  it('先頭末尾の空白を trim する', () => {
    expect(safeFilename('  photo.jpg  ')).toBe('photo.jpg');
  });

  it('先頭末尾のドットを trim する', () => {
    expect(safeFilename('  .hidden  ')).toBe('hidden');
  });

  it('制御文字を除去する', () => {
    // \x00 は制御文字: 除去後 'ab.jpg'
    expect(safeFilename('a\x00b.jpg')).toBe('ab.jpg');
  });

  it('スペースを含む名前: 通常スペースはそのまま保持 (制御文字ではない)', () => {
    // U+0020 はスペースで制御文字ではない。trim のみ。
    expect(safeFilename('a b.jpg')).toBe('a b.jpg');
  });

  it('trim 後に空になったら image を返す', () => {
    expect(safeFilename('   ')).toBe('image');
  });

  it('trim 後にドットだけになったら image を返す', () => {
    expect(safeFilename('...')).toBe('image');
  });

  it('制御文字のみの入力は image を返す', () => {
    expect(safeFilename('\x01\x1f')).toBe('image');
  });
});

describe('uniqueFilename', () => {
  it('existing が空なら desired をそのまま返す', () => {
    expect(uniqueFilename('x.jpg', [])).toBe('x.jpg');
  });

  it('衝突が 1 件なら (2) サフィックスを付与する', () => {
    expect(uniqueFilename('x.jpg', ['x.jpg'])).toBe('x (2).jpg');
  });

  it('衝突が 2 件なら (3) サフィックスを付与する', () => {
    expect(uniqueFilename('x.jpg', ['x.jpg', 'x (2).jpg'])).toBe('x (3).jpg');
  });

  it('existing に該当なし → desired そのまま', () => {
    expect(uniqueFilename('y.jpg', ['x.jpg'])).toBe('y.jpg');
  });

  it('拡張子なしのファイル名でも動作する', () => {
    expect(uniqueFilename('noext', ['noext'])).toBe('noext (2)');
  });

  it('(N) サフィックスが既存リストにある場合もさらにインクリメントする', () => {
    expect(uniqueFilename('img.png', ['img.png', 'img (2).png', 'img (3).png'])).toBe(
      'img (4).png',
    );
  });
});

describe('splitExtension', () => {
  it('最後のドットで base と ext を分割する', () => {
    expect(splitExtension('photo.jpg')).toEqual({ base: 'photo', ext: '.jpg' });
  });

  it('複数ドットがある場合は最後のドットで分割する', () => {
    expect(splitExtension('a.tar.gz')).toEqual({ base: 'a.tar', ext: '.gz' });
  });

  it('拡張子なしのファイル名', () => {
    expect(splitExtension('noext')).toEqual({ base: 'noext', ext: '' });
  });

  it('先頭ドットのみ (隠しファイル) は拡張子なし扱い', () => {
    expect(splitExtension('.gitignore')).toEqual({ base: '.gitignore', ext: '' });
  });

  it('空文字列', () => {
    expect(splitExtension('')).toEqual({ base: '', ext: '' });
  });
});
