import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ deviceScaleFactor: 2 });
const save = JSON.stringify({ player: { name: 'Корреспондент' }, unlockedHalls: ['h01'], solvedTasks: {}, totalScore: 0, visitedPaintings: [], readParagraphs: [] });

test('разворот показывает источники, листается, загружается лениво и возвращает управление', async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem('closed-exhibition-1898:save-v1', value), save);
  await page.goto('/?dev=1#hall/h01');
  await page.waitForFunction(() => Boolean(window.__WORLD_TEST__));
  await page.waitForTimeout(400);
  const initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map((item) => item.name));
  expect(initialResources.some((name) => name.includes('k-istorii-kartiny-repina-001'))).toBe(false);

  await page.evaluate(() => window.__WORLD_TEST__!.interact('painting', 'p01'));
  await expect(page.locator('.postcard')).toHaveAttribute('aria-label', 'Вклеенная открытка без текста');
  await page.screenshot({ path: 'tools/shots/spread/postcard.png' });
  await page.locator('.spread-dialog .icon-button').click();
  await expect(page.locator('.spread-dialog')).toHaveCount(0);

  const links = JSON.parse(readFileSync(new URL('../src/data/links.json', import.meta.url), 'utf8')) as { paintingId?: string; confidence: string; chapterId: string | null; paragraphId: string | null; quote: string }[];
  const candidates = links.filter((link) => link.paintingId && ['high', 'medium'].includes(link.confidence) && link.chapterId && link.paragraphId && link.quote);
  expect(candidates.length).toBeGreaterThan(0);
  for (const link of candidates) {
    await page.evaluate((paintingId) => window.__WORLD_TEST__!.interact('painting', paintingId), link.paintingId!);
    const dialog = page.locator('.spread-dialog').last();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.reader-page')).toContainText(link.quote);
    await expect(dialog.locator('.reader-paragraph.is-cited')).toHaveAttribute('data-paragraph-id', link.paragraphId!);
    await expect(dialog.locator('.spread-caption')).not.toBeEmpty();
    expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('closed-exhibition-1898:save-v1')!).readParagraphs.includes(id), link.paragraphId!)).toBe(true);
    if (link.paintingId === 'p45') {
      const initialChapter = await dialog.locator('.reader-heading').textContent();
      for (let turn = 0; turn < 20; turn += 1) {
        const number = await dialog.locator('.reader-page-number').textContent() ?? '';
        const page = /Страница (\d+) из (\d+)/u.exec(number);
        if (page && Number(page[1]) === Number(page[2])) break;
        // При длинных главах прокрутка подсвеченного абзаца может сдвигать
        // навигацию; отправляем обычное событие кнопки без ожидания layout-stable.
        await dialog.locator('.next-page').click({ force: true });
        await expect.poll(() => dialog.locator('.reader-page-number').textContent()).not.toBe(number);
      }
      await dialog.locator('.next-page').click();
      await expect(dialog.locator('.reader-heading')).not.toHaveText(initialChapter ?? '');
    }
    if (link.paintingId === 'p36') {
      const textClearance = await dialog.evaluate((element) => {
        const paragraph = element.querySelector<HTMLElement>('.reader-paragraph.is-cited')!.getBoundingClientRect();
        const left = element.querySelector<HTMLElement>('.reader-edge-left')!.getBoundingClientRect();
        const right = element.querySelector<HTMLElement>('.reader-edge-right')!.getBoundingClientRect();
        return paragraph.left >= left.right && paragraph.right <= right.left;
      });
      expect(textClearance).toBe(true);
      await expect.poll(() => dialog.locator('.painting-viewport img').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some((item) => item.name.includes('k-istorii-kartiny-repina-001')))).toBe(true);
      await page.screenshot({ path: 'tools/shots/spread/source-spread.png' });
      const image = dialog.locator('.painting-viewport img');
      await image.evaluate((element) => element.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000, bubbles: true, cancelable: true })));
      await expect(image).toHaveAttribute('data-level', 'original');
      await expect(image).toHaveAttribute('data-zoom', '2');
      const viewport = dialog.locator('.painting-viewport');
      const bounds = await viewport.boundingBox();
      if (!bounds) throw new Error('Не найдена область картины для проверки панорамирования.');
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 40, bounds.y + bounds.height / 2 + 24); await page.mouse.up();
      await expect(image).toHaveCSS('transform', /matrix\(2, 0, 0, 2, 40, 24\)/u);
      const before = await dialog.locator('.reader-page-number').textContent();
      await dialog.locator('.next-page').click();
      await expect(dialog.locator('.reader-page-number')).not.toHaveText(before ?? '');
      await expect(dialog.locator('.reader-page')).not.toBeEmpty();
      await dialog.locator('.previous-page').click();
      await expect(dialog.locator('.reader-page')).toContainText(link.quote);
    }
    await dialog.locator('.icon-button').click();
    await expect(page.locator('.spread-dialog')).toHaveCount(0);
  }

  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.gallery-canvas')!;
    let locked = true;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked ? canvas : null });
    document.exitPointerLock = () => { locked = false; };
    canvas.requestPointerLock = () => { locked = true; return Promise.resolve(); };
    window.__WORLD_TEST__!.interact('painting', 'p36');
  });
  await expect(page.locator('.spread-dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === document.querySelector('.gallery-canvas'))).toBe(false);
  await page.keyboard.down('w');
  expect(await page.evaluate(() => window.__WORLD_TEST__!.snapshot().input.forward)).toBe(0);
  await page.keyboard.up('w');
  await page.locator('.spread-dialog .icon-button').click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === document.querySelector('.gallery-canvas'))).toBe(true);
});
