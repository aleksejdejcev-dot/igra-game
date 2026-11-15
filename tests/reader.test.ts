import { describe, expect, it } from 'vitest';
import links from '../src/data/links.json';
import { paginateParagraphs, type ReaderParagraph } from '../src/ui/reader';

const chapters = import.meta.glob('../src/data/texts/*.json', { eager: true, import: 'default' }) as Record<string, { paragraphs: ReaderParagraph[] }>;

describe('страницы книги', () => {
  it('разбивает длинные абзацы примерно по 1200 знаков, не разрывая слова', () => {
    const text = Array.from({ length: 410 }, (_, index) => `слово${index}`).join(' ');
    const pages = paginateParagraphs([{ id: 'p1', text }]);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((page) => page.length <= 1200)).toBe(true);
    expect(pages.flatMap((page) => page.segments).map((segment) => segment.text).join('')).toBe(text);
    for (const page of pages) for (const segment of page.segments) {
      expect(segment.text.trim().split(/\s+/u).every((word) => /^слово\d+$/u.test(word))).toBe(true);
    }
  });

  it('сохраняет длинный отдельный токен целиком', () => {
    const word = 'а'.repeat(1300);
    expect(paginateParagraphs([{ id: 'p1', text: word }])).toEqual([{ length: 1300, segments: [{ paragraphId: 'p1', text: word, start: 0, end: 1300 }] }]);
  });

  it('удерживает цитату связи целиком на одной странице', () => {
    const text = `${'слово '.repeat(198)}важный отрывок находится здесь. ${'конец '.repeat(200)}`;
    const pages = paginateParagraphs([{ id: 'anchor', text }], 1200, { paragraphId: 'anchor', quote: 'важный отрывок находится здесь.' });
    expect(pages.filter((page) => page.segments.map((segment) => segment.text).join('').includes('важный отрывок находится здесь.'))).toHaveLength(1);
  });

  it('каждая связь high/medium картины содержит дословную цитату в опубликованной главе', () => {
    const paintingLinks = links.filter((link) => link.paintingId && ['high', 'medium'].includes(link.confidence));
    expect(paintingLinks).toHaveLength(31);
    for (const link of paintingLinks) {
      expect(link.chapterId, `глава связи ${link.paintingId}`).toBeTruthy();
      const chapter = chapters[`../src/data/texts/${link.chapterId}.json`];
      expect(chapter, `опубликованная глава ${link.chapterId}`).toBeTruthy();
      const paragraph = chapter.paragraphs.find((item) => item.id === link.paragraphId);
      expect(paragraph?.text, `абзац связи ${link.paintingId}`).toContain(link.quote);
    }
  });
});
