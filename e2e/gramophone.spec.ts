import { expect,test } from '@playwright/test';
test('граммофон не запускает записи сам и показывает либретто при недоступном аудио',async({page})=>{
 await page.route('**/assets/audio/*.mp3',route=>route.fulfill({status:404,body:''}));
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/dev.html?dev=1&task=gramophone');
 const records=page.locator('.gramophone-disc');await expect(records).toHaveCount(3);await expect(page.locator('audio')).toHaveCount(3);
 await expect(page.locator('audio').nth(0)).toHaveJSProperty('paused',true);
 await page.getByRole('button',{name:'▤ Стопка либретто'}).click();await expect(page.locator('.gramophone-book section')).toHaveCount(3);
 await records.first().click();await expect(page.locator('.gramophone-subtitles p')).toHaveCount(6);
 await page.locator('.gramophone-play').first().click();await expect(page.locator('.gramophone-status')).toContainText('Записи сохранены');
 expect(errors).toEqual([]);
});
