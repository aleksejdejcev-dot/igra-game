import { expect,test } from '@playwright/test';
test('мемо показывает двенадцать карточек и учитывает цену первой записки',async({page})=>{
  await page.goto('/dev.html?dev=1&task=memo');await expect(page.locator('.memo-card')).toHaveCount(12);
  await page.locator('.task-hint-lamp').click();await expect(page.locator('.task-hint-note')).toContainText('25%');
  await page.locator('.task-hint-lamp').click();await expect(page.locator('.task-hint-note')).toHaveText('Пары одинаковых полотен спрятаны среди карточек.');
  await page.screenshot({path:'tools/shots/tasks-a/memo.png'});
  await page.goto('/dev.html?dev=1&task=memo&maxMoves=1');const first=page.locator('.memo-card').first();const pair=await first.getAttribute('data-pair');const miss=page.locator(`.memo-card[data-pair]:not([data-pair="${pair}"])`).first();await first.click();await miss.click();await expect(page.locator('.task-status')).toHaveText('Ходы: 1 из 1');await expect(page.locator('.memo-card.is-open')).toHaveCount(0);
  const next=page.locator('.memo-card').first();const nextPair=await next.getAttribute('data-pair');const nextMiss=page.locator(`.memo-card[data-pair]:not([data-pair="${nextPair}"])`).first();await next.click();await nextMiss.click();await expect(page.locator('.task-status')).toHaveText('Ходы: 0 из 1',{timeout:3000});
});
