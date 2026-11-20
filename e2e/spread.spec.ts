import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

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

  const links = JSON.parse(readFileSync(new URL('../src/data/links.json', import.meta.url), 'utf8')) as { paintingId?: string; confidence: string; chapterId: string | null; paragraphId: string | null; quote: string; headingText?: string; headingSource?: string; headingRef?: string; anchorQuote?: string }[];
  const paintings = JSON.parse(readFileSync(new URL('../src/data/paintings.json', import.meta.url), 'utf8')) as { id: string; title: string; artist: string; artistShort: string }[];
  const candidates = links.filter((link) => link.paintingId && ['high', 'medium'].includes(link.confidence) && link.chapterId && link.paragraphId && link.quote);
  expect(candidates.length).toBeGreaterThan(0);
  mkdirSync('tools/shots/scene-heading', { recursive: true });
  for (const [candidateIndex, link] of candidates.entries()) {
    await page.evaluate((paintingId) => window.__WORLD_TEST__!.interact('painting', paintingId), link.paintingId!);
    const dialog = page.locator('.spread-dialog').last();
    await expect(dialog).toBeVisible();
    const renderedSourceParagraph = () => dialog.locator(`.reader-paragraph[data-paragraph-id="${link.paragraphId}"]`).evaluateAll((paragraphs) => paragraphs.map((paragraph) => paragraph.textContent ?? '').join(''));
    await expect.poll(renderedSourceParagraph).toContain(link.quote);
    const sceneHeading = dialog.locator(`.scene-heading[data-scene-painting="${link.paintingId}"]`);
    await expect(sceneHeading).toHaveCount(1);
    await expect(sceneHeading.locator('.scene-heading-title')).toHaveText(link.headingText!);
    await expect(sceneHeading.locator('.scene-heading-source')).not.toBeEmpty();
    const painting = paintings.find((item) => item.id === link.paintingId)!;
    expect(link.headingText).not.toContain(painting.title);
    expect(link.headingText).not.toContain(painting.artist);
    expect(link.headingText).not.toContain(painting.artistShort);
    const sourceFollowsHeading = await dialog.locator('.reader-page').evaluate((pageNode, args) => {
      const children = [...pageNode.children];
      const headingIndex = children.findIndex((child) => child.matches('.scene-heading'));
      const following = children.slice(headingIndex + 1).map((child) => child.textContent ?? '').join(' ');
      return args.source === 'verbatim-phrase' ? following.includes(args.anchor) : following.includes(args.quote);
    }, { source: link.headingSource, anchor: link.anchorQuote ?? '', quote: link.quote });
    expect(sourceFollowsHeading).toBe(true);
    const sameSceneLinks = links.filter((scene) => ['high', 'medium'].includes(scene.confidence) && scene.chapterId === link.chapterId && scene.paragraphId === link.paragraphId && scene.anchorQuote === link.anchorQuote && scene.paintingId)
      .sort((a, b) => Number(a.paintingId?.slice(1)) - Number(b.paintingId?.slice(1)));
    if (sameSceneLinks.length > 1) {
      const headingsInOrder = await dialog.locator('.reader-page').evaluate((pageNode) => [...pageNode.querySelectorAll<HTMLElement>('.scene-heading')].map((heading) => heading.dataset.scenePainting));
      const expectedIds = sameSceneLinks.map((scene) => scene.paintingId);
      const positions = expectedIds.map((id) => headingsInOrder.indexOf(id));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(positions.at(-1)! - positions[0]).toBe(expectedIds.length - 1);
    }
    await expect(dialog.locator('.spread-caption')).not.toBeEmpty();
    expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('closed-exhibition-1898:save-v1')!).readParagraphs.includes(id), link.paragraphId!)).toBe(true);
    if (candidateIndex < 5) {
      await page.waitForTimeout(450);
      await page.screenshot({ path: `tools/shots/scene-heading/${link.paintingId}.png` });
    }
    if (link.paintingId === 'p36') {
      const textClearance = await dialog.evaluate((element) => {
        const paragraph = element.querySelector<HTMLElement>('.scene-heading')!.getBoundingClientRect();
        const left = element.querySelector<HTMLElement>('.reader-edge-left')!.getBoundingClientRect();
        const right = element.querySelector<HTMLElement>('.reader-edge-right')!.getBoundingClientRect();
        return paragraph.left >= left.right && paragraph.right <= right.left;
      });
      expect(textClearance).toBe(true);
      await expect.poll(() => dialog.locator('.painting-viewport img').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate((chapterId) => performance.getEntriesByType('resource').some((item) => item.name.includes(chapterId)), link.chapterId!)).toBe(true);
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
      await expect(dialog.locator('.reader-page')).not.toBeEmpty();
      await expect(dialog.locator('.reader-page')).toContainText(link.quote);
    }
    await dialog.evaluate((element) => (element as HTMLDialogElement).close());
    await expect(page.locator('.spread-dialog')).toHaveCount(0);
  }

  const responsiveLink = candidates.find((link) => link.paintingId === 'p07')!;
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate((paintingId) => window.__WORLD_TEST__!.interact('painting', paintingId), responsiveLink.paintingId!);
    const dialog = page.locator('.spread-dialog').last();
    await expect(dialog.locator(`.scene-heading[data-scene-painting="${responsiveLink.paintingId}"]`)).toHaveCount(1);
    const responsiveParagraphText = await dialog.locator(`.reader-paragraph[data-paragraph-id="${responsiveLink.paragraphId}"]`).evaluateAll((paragraphs) => paragraphs.map((paragraph) => paragraph.textContent ?? '').join(''));
    expect(responsiveParagraphText).toContain(responsiveLink.quote);
    const leadLines = await dialog.locator('.reader-page').evaluate((pageNode, paintingId) => {
      const headings = [...pageNode.querySelectorAll<HTMLElement>('.scene-heading')];
      const index = headings.findIndex((heading) => heading.dataset.scenePainting === paintingId);
      return pageNode.textContent?.slice(pageNode.textContent.indexOf(headings[index]?.textContent ?? '') + (headings[index]?.textContent?.length ?? 0)).trim().length ?? 0;
    }, responsiveLink.paintingId!);
    expect(leadLines).toBeGreaterThanOrEqual(180);
    await dialog.evaluate((element) => (element as HTMLDialogElement).close());
    await expect(page.locator('.spread-dialog')).toHaveCount(0);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
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
