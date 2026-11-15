import { expect,test } from '@playwright/test';
test('каталожные подписи сопоставляются с картинами клавиатурой и завершают дело',async({page})=>{
  await page.goto('/dev.html?dev=1&task=match-captions');await expect(page.locator('.match-picture')).toHaveCount(4);await expect(page.locator('.match-caption')).toHaveCount(4);await page.screenshot({path:'tools/shots/tasks-a/match-captions.png'});
  const ids=await page.locator('.match-picture').evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.paintingId!));
  const wrongLabel=page.locator(`.match-caption[data-painting-id="${ids[0]===ids[1]?ids[2]:ids[1]}"]`);await page.locator(`.match-picture[data-painting-id="${ids[0]}"]`).focus();await page.keyboard.press('Enter');await wrongLabel.focus();await page.keyboard.press('Enter');await page.locator('.task-hint-lamp').click();await page.locator('.task-hint-lamp').click();await expect(page.locator('.match-picture.is-hint')).toHaveCount(1);await expect(page.locator('.match-caption.is-hint')).toHaveCount(1);
  for(const id of ids){await page.locator(`.match-picture[data-painting-id="${id}"]`).focus();await page.keyboard.press('Enter');await page.locator(`.match-caption[data-painting-id="${id}"]`).focus();await page.keyboard.press('Enter');}
  await expect(page.locator('.task-result-seal')).toContainText('Печать редакции поставлена');
});
