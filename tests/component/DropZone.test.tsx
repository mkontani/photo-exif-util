import { DropZone } from '@/ui/components/DropZone';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['fake-content'], name, { type });
}

describe('DropZone', () => {
  it('ファイルドロップで onFiles が呼ばれる', () => {
    const onFiles = vi.fn();
    const { getByRole } = render(() => <DropZone onFiles={onFiles} />);
    const dropzone = getByRole('button');
    const file = makeFile();
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('file input の change で onFiles が呼ばれる', () => {
    const onFiles = vi.fn();
    const { container } = render(() => <DropZone onFiles={onFiles} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = makeFile();
    // files プロパティを上書きして change イベントを発火
    Object.defineProperty(input, 'files', { value: [file], writable: false, configurable: true });
    fireEvent.change(input as Element);
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('URL input に入力して Enter を押すと onUrl が呼ばれる', () => {
    const onFiles = vi.fn();
    const onUrl = vi.fn();
    const { getByRole } = render(() => <DropZone onFiles={onFiles} onUrl={onUrl} />);
    const urlInput = getByRole('textbox');
    fireEvent.input(urlInput, { target: { value: 'https://example.com/photo.jpg' } });
    fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });
    expect(onUrl).toHaveBeenCalledOnce();
    expect(onUrl).toHaveBeenCalledWith('https://example.com/photo.jpg');
  });

  it('空 URL では onUrl が呼ばれない', () => {
    const onFiles = vi.fn();
    const onUrl = vi.fn();
    const { getByRole } = render(() => <DropZone onFiles={onFiles} onUrl={onUrl} />);
    const urlInput = getByRole('textbox');
    fireEvent.input(urlInput, { target: { value: '' } });
    fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });
    expect(onUrl).not.toHaveBeenCalled();
  });

  it('空白のみの URL では onUrl が呼ばれない', () => {
    const onFiles = vi.fn();
    const onUrl = vi.fn();
    const { getByRole } = render(() => <DropZone onFiles={onFiles} onUrl={onUrl} />);
    const urlInput = getByRole('textbox');
    fireEvent.input(urlInput, { target: { value: '   ' } });
    fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });
    expect(onUrl).not.toHaveBeenCalled();
  });

  it('disabled=true のとき ドロップしても onFiles が呼ばれない', () => {
    const onFiles = vi.fn();
    const { getByRole } = render(() => <DropZone onFiles={onFiles} disabled={true} />);
    const dropzone = getByRole('button');
    const file = makeFile();
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('ヒントテキスト「ドロップ」が表示される', () => {
    const { getByText } = render(() => <DropZone onFiles={vi.fn()} />);
    expect(getByText(/ドロップ/)).toBeTruthy();
  });

  it('URL input に aria-label が設定されている', () => {
    const { getByLabelText } = render(() => <DropZone onFiles={vi.fn()} />);
    expect(getByLabelText(/URL/i)).toBeTruthy();
  });
});
