import { Reader, type ChapterLoader } from './reader';
import type { PaintingLink, TextIndex } from './types';

export interface SourceReaderOptions {
  app: HTMLElement;
  link: PaintingLink;
  textIndex: TextIndex;
  loadChapter: ChapterLoader;
  onReadParagraph: (paragraphId: string) => void;
}

export function createSourceReader(options: SourceReaderOptions): HTMLDialogElement | null {
  const { link } = options;
  if (!link.bookId || !link.chapterId || !link.paragraphId) return null;
  const book = options.textIndex.books.find((item) => item.id === link.bookId);
  const chapter = book?.chapters.find((item) => item.id === link.chapterId);
  const dialog = document.createElement('dialog');
  dialog.className = 'content-dialog source-reader-dialog';
  dialog.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'dialog-head';
  const title = document.createElement('h2');
  title.textContent = `${book?.title ?? 'Книга-источник'} · ${chapter?.title ?? 'Отмеченный фрагмент'}`;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-button';
  close.setAttribute('aria-label', 'Закрыть');
  close.textContent = '×';
  close.addEventListener('click', () => dialog.close());
  header.append(title, close);

  const body = document.createElement('div');
  body.className = 'dialog-body source-reader-body';
  const root = document.createElement('div');
  root.className = 'reader-root';
  body.append(root);
  dialog.append(header, body);
  options.app.append(dialog);

  const reader = new Reader({
    container: root,
    index: options.textIndex,
    bookId: link.bookId,
    chapterId: link.chapterId,
    paragraphId: link.paragraphId,
    quote: link.quote,
    loadChapter: options.loadChapter,
    onReadParagraph: options.onReadParagraph,
  });
  dialog.addEventListener('close', () => {
    reader.destroy();
    dialog.remove();
  }, { once: true });
  return dialog;
}
