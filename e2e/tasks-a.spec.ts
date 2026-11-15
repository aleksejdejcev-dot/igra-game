import { expect,test } from '@playwright/test';
test.use({deviceScaleFactor:2});
test('четыре задания открываются на пробной полосе и принимают клавиатурный ввод',async({page})=>{
  await page.goto('/dev.html?dev=1&task=memo');await expect(page.locator('.memo-card')).toHaveCount(12);await page.screenshot({path:'tools/shots/tasks-a/memo.png'});
  await page.locator('.task-hint-lamp').click();await expect(page.locator('.task-hint-note')).toContainText('25%');await page.locator('.task-hint-lamp').click();await expect(page.locator('.task-hint-note')).toContainText('Записка 1');
  await page.goto('/dev.html?dev=1&task=puzzle');await expect(page.locator('.puzzle-tile')).toHaveCount(12);await page.screenshot({path:'tools/shots/tasks-a/puzzle.png'});
  const first=page.locator('.puzzle-tile').first(),second=page.locator('.puzzle-tile').nth(1);await first.click();await second.click();await expect(page.locator('.puzzle-tile.is-selected')).toHaveCount(0);
  await page.goto('/dev.html?dev=1&task=match-captions');await expect(page.locator('.match-picture')).toHaveCount(4);await expect(page.locator('.match-caption')).toHaveCount(4);await page.locator('.match-picture').first().focus();await page.keyboard.press('Enter');await page.locator('.match-caption').first().focus();await page.keyboard.press('Enter');await expect(page.locator('.match-picture[aria-pressed="true"]')).toHaveCount(0);await page.screenshot({path:'tools/shots/tasks-a/match-captions.png'});
  await page.goto('/dev.html?dev=1&task=fill-words-repnin');await expect(page.locator('.poem-text p')).toHaveCount(46);await expect(page.locator('.fill-word')).toHaveCount(8);await page.screenshot({path:'tools/shots/tasks-a/fill-words-repnin.png'});const word=page.locator('.fill-word').first();await word.fill('ХОРОВОД');await word.press('Enter');await expect(word).toBeDisabled();
  await page.goto('/dev.html?dev=1&task=fill-words-monument');await expect(page.locator('.fill-name-field input')).toHaveCount(3);await expect(page.locator('.monument-image')).toBeVisible();await page.screenshot({path:'tools/shots/tasks-a/fill-words-monument.png'});
});
