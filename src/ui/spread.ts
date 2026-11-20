import type { Painting, PaintingLink, TextIndex } from './types';
import { Reader, type ChapterLoader, type ReaderScene } from './reader';

export interface SpreadOptions {
  app: HTMLElement;
  painting: Painting;
  link: PaintingLink | undefined;
  baseUrl: string;
  textIndex: TextIndex;
  loadChapter: ChapterLoader;
  onReadParagraph: (paragraphId: string) => void;
  onClose: () => void;
  heading?: string;
  scenes?: ReaderScene[];
}

export interface SpreadView { dialog: HTMLDialogElement; reader: Reader | null }

export function createSpread(options: SpreadOptions): SpreadView {
  const { painting, link } = options;
  const sourceLink = link?.bookId && link.chapterId && link.paragraphId ? link : undefined;
  const dialog = document.createElement('dialog');
  dialog.className = `content-dialog spread-dialog${options.heading === 'Книга-источник' ? ' book-dialog' : ''}`;
  dialog.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'dialog-head';
  const title = document.createElement('h2');
  title.textContent = options.heading ?? 'Разворот корреспондента';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'icon-button'; close.setAttribute('aria-label', 'Закрыть'); close.textContent = '×';
  header.append(title, close);

  const content = document.createElement('div');
  content.className = 'spread-content';
  const figure = document.createElement('figure');
  const viewport = document.createElement('div'); viewport.className = 'painting-viewport'; viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', 'Изображение картины; колесо мыши меняет увеличение');
  const image = document.createElement('img');
  image.alt = painting.caption;
  image.draggable = false;
  image.loading = 'eager';
  image.decoding = 'async';
  const large = painting.large ?? painting.src;
  const original = painting.original ?? large;
  image.src = `${options.baseUrl}assets/paintings/${large}`;
  if (original !== large) {
    image.srcset = `${options.baseUrl}assets/paintings/${large} 1x, ${options.baseUrl}assets/paintings/${original} 2x`;
    image.sizes = '(min-width: 900px) 44vw, 90vw';
  }
  image.dataset.zoom = '1'; image.dataset.level = 'large';
  viewport.append(image);
  const caption = document.createElement('figcaption');
  caption.className = 'spread-caption';
  caption.textContent = [painting.artist, painting.title, painting.year].filter(Boolean).join(' · ');
  figure.append(viewport, caption);

  const article = document.createElement('article'); article.className = 'spread-reading';
  let reader: Reader | null = null;
  if (sourceLink) {
    const container = document.createElement('div'); container.className = 'reader-root'; article.append(container);
    reader = new Reader({
      container, index: options.textIndex, bookId: sourceLink.bookId!, chapterId: sourceLink.chapterId!,
      paragraphId: sourceLink.paragraphId!, quote: sourceLink.quote,
      scenes: options.scenes, targetPaintingId: painting.id,
      loadChapter: options.loadChapter, onReadParagraph: options.onReadParagraph,
    });
  } else {
    const card = document.createElement('div'); card.className = 'postcard'; card.setAttribute('role', 'img');
    card.setAttribute('aria-label', 'Вклеенная открытка без текста');
    const frame = document.createElement('div'); frame.className = 'postcard-frame';
    const stamp = document.createElement('span'); stamp.className = 'postcard-stamp'; stamp.setAttribute('aria-hidden', 'true');
    frame.append(stamp); card.append(frame); article.append(card);
  }
  content.append(figure, article);
  dialog.append(header, content);
  options.app.append(dialog);

  let zoom = 1, panX = 0, panY = 0, dragOrigin: { x: number; y: number; panX: number; panY: number } | null = null;
  const applyTransform = (): void => { image.dataset.zoom = String(zoom); image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; };
  const setImageLevel = (): void => {
    if (zoom > 1.5 && image.dataset.level !== 'original') {
      image.srcset = '';
      image.src = `${options.baseUrl}assets/paintings/${original}`;
      image.dataset.level = 'original';
    } else if (zoom <= 1.5 && image.dataset.level !== 'large') {
      image.srcset = original !== large ? `${options.baseUrl}assets/paintings/${large} 1x, ${options.baseUrl}assets/paintings/${original} 2x` : '';
      image.src = `${options.baseUrl}assets/paintings/${large}`;
      image.dataset.level = 'large';
    }
  };
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoom = Math.max(1, Math.min(4, zoom - event.deltaY * .001));
    if (zoom === 1) panX = panY = 0;
    setImageLevel(); applyTransform();
  }, { passive: false });
  viewport.addEventListener('pointerdown', (event) => {
    if (zoom <= 1) return;
    dragOrigin = { x: event.clientX, y: event.clientY, panX, panY };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!dragOrigin) return;
    panX = dragOrigin.panX + event.clientX - dragOrigin.x;
    panY = dragOrigin.panY + event.clientY - dragOrigin.y;
    applyTransform();
  });
  const endDrag = (): void => { dragOrigin = null; };
  viewport.addEventListener('pointerup', endDrag); viewport.addEventListener('pointercancel', endDrag);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { reader?.destroy(); dialog.remove(); options.onClose(); }, { once: true });
  return { dialog, reader };
}
