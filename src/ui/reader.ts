import type { TextIndex } from './types';

export interface ReaderParagraph { id: string; text: string }
export interface ReaderChapter { id: string; title?: string; paragraphs: ReaderParagraph[] }
export type ChapterLoader = (chapterId: string) => Promise<ReaderChapter | null>;
interface PageSegment { paragraphId: string; text: string; start: number; end: number }
export interface ReaderPage { segments: PageSegment[]; length: number }

export function paginateParagraphs(
  paragraphs: ReaderParagraph[],
  limit = 1200,
  anchor?: { paragraphId: string; quote: string },
): ReaderPage[] {
  const pages: ReaderPage[] = [];
  let page: ReaderPage = { segments: [], length: 0 };
  const flush = (): void => {
    if (!page.segments.length) return;
    pages.push(page);
    page = { segments: [], length: 0 };
  };
  for (const paragraph of paragraphs) {
    const words = paragraph.text.match(/\S+\s*/gu) ?? [];
    let offset = 0;
    const quoteStart = paragraph.id === anchor?.paragraphId ? paragraph.text.indexOf(anchor.quote) : -1;
    const quoteEnd = quoteStart < 0 ? -1 : quoteStart + anchor!.quote.length;
    for (const word of words) {
      const last = page.segments.at(-1);
      const insideAnchorQuote = quoteStart >= 0 && last?.paragraphId === paragraph.id && last.end > quoteStart && offset < quoteEnd;
      if (page.length > 0 && page.length + word.length > limit && !insideAnchorQuote) flush();
      const previous = page.segments.at(-1);
      if (previous?.paragraphId === paragraph.id && previous.end === offset) {
        previous.text += word;
        previous.end += word.length;
      } else {
        page.segments.push({ paragraphId: paragraph.id, text: word, start: offset, end: offset + word.length });
      }
      page.length += word.length;
      offset += word.length;
    }
    if (!words.length && paragraph.text) {
      if (page.length && page.length + paragraph.text.length > limit) flush();
      page.segments.push({ paragraphId: paragraph.id, text: paragraph.text, start: 0, end: paragraph.text.length });
      page.length += paragraph.text.length;
    }
  }
  flush();
  return pages;
}

export interface ReaderOptions {
  container: HTMLElement;
  index: TextIndex;
  bookId: string;
  chapterId: string;
  paragraphId: string;
  quote: string;
  loadChapter: ChapterLoader;
  onReadParagraph: (paragraphId: string) => void;
}

export class Reader {
  readonly ready: Promise<void>;
  private readonly book;
  private chapters: { id: string; title: string }[];
  private chapterPosition: number;
  private chapter: ReaderChapter | null = null;
  private pages: ReaderPage[] = [];
  private pagePosition = 0;
  private destroyed = false;
  private readonly heading: HTMLElement;
  private readonly pageNode: HTMLElement;
  private readonly status: HTMLElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly pageNumber: HTMLElement;
  private readonly onKeyDown: (event: KeyboardEvent) => void;

  constructor(private options: ReaderOptions) {
    this.book = options.index.books.find((book) => book.id === options.bookId)
      ?? options.index.books.find((book) => book.chapters.some((chapter) => chapter.id === options.chapterId));
    this.chapters = this.book?.chapters ?? [];
    this.chapterPosition = Math.max(0, this.chapters.findIndex((chapter) => chapter.id === options.chapterId));
    options.container.classList.add('reader');
    options.container.replaceChildren();
    this.heading = document.createElement('h3');
    this.heading.className = 'reader-heading';
    this.status = document.createElement('p');
    this.status.className = 'reader-status';
    this.status.setAttribute('role', 'status');
    this.pageNode = document.createElement('div');
    this.pageNode.className = 'reader-page book-pages';
    this.pageNode.setAttribute('aria-live', 'polite');
    const nav = document.createElement('nav');
    nav.className = 'page-turns reader-turns';
    this.previous = document.createElement('button');
    this.previous.type = 'button';
    this.previous.className = 'secondary-button previous-page';
    this.previous.textContent = 'Назад';
    this.previous.setAttribute('aria-label', 'Предыдущая страница');
    this.pageNumber = document.createElement('span');
    this.pageNumber.className = 'reader-page-number';
    this.next = document.createElement('button');
    this.next.type = 'button';
    this.next.className = 'secondary-button next-page';
    this.next.textContent = 'Вперёд';
    this.next.setAttribute('aria-label', 'Следующая страница');
    nav.append(this.previous, this.pageNumber, this.next);
    const sides = document.createElement('div');
    sides.className = 'reader-side-zones';
    const left = document.createElement('button');
    left.type = 'button'; left.className = 'reader-edge reader-edge-left'; left.setAttribute('aria-label', 'Предыдущая страница'); left.textContent = '‹';
    const right = document.createElement('button');
    right.type = 'button'; right.className = 'reader-edge reader-edge-right'; right.setAttribute('aria-label', 'Следующая страница'); right.textContent = '›';
    sides.append(left, right);
    options.container.append(this.heading, this.status, this.pageNode, nav, sides);
    this.previous.addEventListener('click', this.turnPrevious);
    left.addEventListener('click', this.turnPrevious);
    this.next.addEventListener('click', this.turnNext);
    right.addEventListener('click', this.turnNext);
    this.onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); this.turnPrevious(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); this.turnNext(); }
    };
    options.container.closest('dialog')?.addEventListener('keydown', this.onKeyDown);
    this.ready = this.loadAt(this.chapterPosition, options.paragraphId, 0);
  }

  private turnPrevious = (): void => {
    if (this.pagePosition > 0) { this.pagePosition -= 1; this.renderPage(); return; }
    if (this.chapterPosition > 0) void this.loadAt(this.chapterPosition - 1, '', -1);
  };

  private turnNext = (): void => {
    if (this.pagePosition + 1 < this.pages.length) { this.pagePosition += 1; this.renderPage(); return; }
    if (this.chapterPosition + 1 < this.chapters.length) void this.loadAt(this.chapterPosition + 1, '', 1);
  };

  private async loadAt(position: number, paragraphId: string, direction: -1 | 0 | 1): Promise<void> {
    this.status.textContent = 'Листы книги раскрываются…';
    let chapterMeta = this.chapters[position];
    let data: ReaderChapter | null = null;
    while (chapterMeta && !data) {
      this.chapterPosition = position;
      data = await this.options.loadChapter(chapterMeta.id);
      if (!data && direction !== 0) { position += direction; chapterMeta = this.chapters[position]; }
      else break;
    }
    if (this.destroyed) return;
    this.chapter = null; this.pages = []; this.pageNode.replaceChildren();
    if (!chapterMeta) { this.status.textContent = 'Эта глава не включена в книгу.'; this.updateNavigation(); return; }
    if (!data) { this.status.textContent = 'Не удалось открыть главу.'; this.updateNavigation(); return; }
    this.chapterPosition = position;
    this.chapter = data;
    this.pages = paginateParagraphs(data.paragraphs, 1200, { paragraphId: this.options.paragraphId, quote: this.options.quote });
    if (direction < 0) this.pagePosition = Math.max(0, this.pages.length - 1);
    else if (direction > 0) this.pagePosition = 0;
    else this.pagePosition = this.findAnchorPage(paragraphId, this.options.quote);
    this.heading.textContent = `${this.book?.title ?? this.options.bookId} · ${chapterMeta.title || data.title || ''}`;
    this.status.textContent = '';
    this.renderPage();
    if (direction === 0) this.pageNode.querySelector<HTMLElement>('.reader-paragraph.is-cited')?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
  }

  private findAnchorPage(paragraphId: string, quote: string): number {
    const quoteStart = this.chapter?.paragraphs.find((paragraph) => paragraph.id === paragraphId)?.text.indexOf(quote) ?? -1;
    const targetEnd = quoteStart < 0 ? -1 : quoteStart + quote.length;
    const pageIndex = this.pages.findIndex((page) => page.segments.some((segment) => segment.paragraphId === paragraphId
      && (quoteStart < 0 || segment.start < targetEnd && segment.end > quoteStart)));
    return Math.max(0, pageIndex);
  }

  private renderPage(): void {
    this.pageNode.replaceChildren();
    const page = this.pages[this.pagePosition];
    for (const segment of page?.segments ?? []) {
      const paragraph = document.createElement('p');
      paragraph.className = 'reader-paragraph';
      paragraph.dataset.paragraphId = segment.paragraphId;
      paragraph.textContent = segment.text;
      paragraph.classList.toggle('is-cited', segment.paragraphId === this.options.paragraphId);
      this.pageNode.append(paragraph);
      this.options.onReadParagraph(segment.paragraphId);
    }
    this.pageNumber.textContent = this.pages.length ? `Страница ${this.pagePosition + 1} из ${this.pages.length}` : '';
    this.updateNavigation();
  }

  private updateNavigation(): void {
    this.previous.disabled = this.pagePosition === 0 && this.chapterPosition === 0;
    this.next.disabled = this.pagePosition + 1 >= this.pages.length && this.chapterPosition + 1 >= this.chapters.length;
  }

  destroy(): void {
    this.destroyed = true;
    this.options.container.closest('dialog')?.removeEventListener('keydown', this.onKeyDown);
  }
}
