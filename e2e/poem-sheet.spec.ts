import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('лист Репнина находится в комнате, виден с пола и открывает полный текст', async ({ page }) => {
  await mkdir('tools/shots/poem-sheet', { recursive: true });
  await page.addInitScript(() => localStorage.setItem('closed-exhibition-1898:save-v1', JSON.stringify({
    player: { name: 'Корреспондент' }, unlockedHalls: ['h01', 'h02', 'h03', 'h04'], solvedTasks: {
      memo: { points: 100, attempts: 1, hintsUsed: 0 }, puzzle: { points: 100, attempts: 1, hintsUsed: 0 },
      'match-captions': { points: 100, attempts: 1, hintsUsed: 0 }, 'crossword-names': { points: 100, attempts: 1, hintsUsed: 0 },
    }, totalScore: 400,
    visitedPaintings: [], readParagraphs: [], finaleResponse: null,
  })));
  await page.goto('/?dev=1#hall/h04');
  await expect(page.locator('.hall-caption b')).toHaveText('«Опричнина»');
  await page.evaluate(() => window.__WORLD_TEST__?.setAngles(0, 0));
  await page.waitForTimeout(300);
  await page.locator('.gallery-canvas').screenshot({ path: 'tools/shots/poem-sheet/oprichnina-floor.png' });
  const canvas = page.locator('.gallery-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas gallery is not visible');
  let paperPoint: { x: number; y: number } | null = null;
  for (let y = box.height * .8; y < box.height && !paperPoint; y += 24) {
    for (let x = box.width * .08; x < box.width * .42 && !paperPoint; x += 24) {
      await page.mouse.move(box.x + x, box.y + y);
      await page.waitForTimeout(20);
      if ((await canvas.getAttribute('title'))?.includes('Стихотворный лист')) paperPoint = { x: box.x + x, y: box.y + y };
    }
  }
  expect(paperPoint).not.toBeNull();
  await page.mouse.click(paperPoint.x, paperPoint.y);
  await expect(page.locator('.poem-sheet-dialog')).toBeVisible();
  await expect(page.locator('.poem-sheet-dialog h2')).toHaveText('Князь Михайло Репнин · А. К. Толстой');
  await expect(page.locator('.poem-sheet p').first()).not.toBeEmpty();
});
