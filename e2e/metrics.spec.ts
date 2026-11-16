import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const halls = JSON.parse(readFileSync(new URL('../src/data/halls.json', import.meta.url), 'utf8')) as Array<{ id: string }>;

test('renderer budgets across gallery halls', async ({ page }) => {
  const solvedTasks = { memo: { points: 100 }, puzzle: { points: 100 } };
  const save = JSON.stringify({ player: { name: 'Корреспондент' }, unlockedHalls: halls.map(hall => hall.id), solvedTasks, totalScore: 200, visitedPaintings: [], readParagraphs: [] });
  await page.addInitScript(value => localStorage.setItem('closed-exhibition-1898:save-v1', value), save);
  test.setTimeout(240000);
  const measurements: Array<{ hall: string; calls: number; triangles: number; textures: number }> = [];
  for (const hall of halls.slice(0, 2)) {
    await page.goto(`/?dev=1#hall/${hall.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('.world-status')?.getAttribute('data-metrics')));
    const metrics = await page.locator('.world-status').evaluate(element => JSON.parse(element.getAttribute('data-metrics')!));
    measurements.push({ hall: hall.id, ...metrics });
    expect(metrics.calls).toBeLessThanOrEqual(200);
    expect(metrics.triangles).toBeLessThanOrEqual(250000);
  }
  console.log('renderer.info per hall:', JSON.stringify(measurements));
});
