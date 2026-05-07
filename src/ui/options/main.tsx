/**
 * Options page エントリポイント。
 * OptionsApp コンポーネントは OptionsApp.tsx に分離されている。
 * このファイルは DOM へのマウントのみを担う。
 */
import { render } from 'solid-js/web';
import { OptionsApp } from './OptionsApp';

const root = document.getElementById('root');
if (root) {
  render(() => <OptionsApp />, root);
}
