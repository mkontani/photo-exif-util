import { setI18nTestDict, t } from '@/ui/i18n/t';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  // 各テスト後にテスト辞書をリセット
  setI18nTestDict(null);
});

describe('t (i18n ヘルパ)', () => {
  it('テスト辞書のキーが返る', () => {
    setI18nTestDict({ extName: 'Photo EXIF Util' });
    expect(t('extName')).toBe('Photo EXIF Util');
  });

  it('テスト辞書にないキーは fallback を返す', () => {
    setI18nTestDict({});
    expect(t('unknownKey', undefined, 'default value')).toBe('default value');
  });

  it('fallback もなければキー自体を返す', () => {
    setI18nTestDict({});
    expect(t('someKey')).toBe('someKey');
  });

  it('substitutions が機能する (テスト辞書)', () => {
    // テスト辞書では $1 形式で単純展開
    setI18nTestDict({ greet: 'Hello $1' });
    expect(t('greet', ['World'])).toBe('Hello World');
  });

  it('複数の substitutions が機能する', () => {
    setI18nTestDict({ msg: '$1 and $2' });
    expect(t('msg', ['foo', 'bar'])).toBe('foo and bar');
  });

  it('substitutions が空配列の場合はそのまま返す', () => {
    setI18nTestDict({ plain: 'No substitution' });
    expect(t('plain', [])).toBe('No substitution');
  });

  it('テスト辞書 null のとき chrome.i18n にフォールバックを試みる', () => {
    // jsdom には chrome が存在しないため、エラーにならず fallback を返す
    setI18nTestDict(null);
    expect(t('anyKey', undefined, 'fb')).toBe('fb');
  });

  it('chrome.i18n も空文字を返したらキーを返す', () => {
    setI18nTestDict(null);
    // chrome が未定義なのでキーが返る
    expect(t('bareKey')).toBe('bareKey');
  });
});
