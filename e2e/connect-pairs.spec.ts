import { expect,test } from '@playwright/test';
test('портреты соединяются попарно линиями',async({page})=>{
 await page.goto('/dev.html?dev=1&task=connect-pairs');
 await expect(page.locator('.connect-book-covers img')).toHaveCount(3);
 for(const [composer,writer] of [['rubinstein','lermontov'],['mussorgsky','pushkin'],['tchaikovsky','lazhechnikov']]){
  await page.locator(`[data-person="${composer}"]`).click();await page.locator(`[data-person="${writer}"]`).click();
 }
 await expect(page.locator('.connect-lines line')).toHaveCount(3);await expect(page.locator('.task-result-seal')).toBeVisible();
});
