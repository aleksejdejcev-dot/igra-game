import { expect,test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test('граммофон не запускает записи сам и показывает либретто при недоступном аудио',async({page})=>{
 await mkdir('tools/shots/gramophone',{recursive:true});
 await page.route('**/assets/audio/*.mp3',route=>route.fulfill({status:404,body:''}));
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/dev.html?dev=1&task=gramophone');
 const records=page.locator('.gramophone-disc');await expect(records).toHaveCount(3);await expect(page.locator('audio')).toHaveCount(3);
 await expect(page.locator('audio').nth(0)).toHaveJSProperty('paused',true);
 await expect(page.locator('.gramophone-instruction')).toContainText('конвертам с названиями опер');
 await page.getByRole('button',{name:'▤ Стопка либретто'}).click();await expect(page.locator('.gramophone-book section')).toHaveCount(3);
 await page.locator('.gramophone-disc[data-record="boris.mp3"]').click();await expect(page.locator('.gramophone-subtitles p')).toHaveCount(6);await expect(page.locator('.gramophone-status')).toContainText('Пластинка отмечена');
 await page.locator('.gramophone-play[data-play="boris.mp3"]').click();await expect(page.locator('.gramophone-status')).toContainText('Записи сохранены');
 await page.screenshot({path:'tools/shots/gramophone/overlay.png'});
 await page.getByRole('button',{name:'Конверт: Борис Годунов'}).click();await expect(page.locator('.gramophone-disc[data-record="boris.mp3"]')).toBeDisabled();
 await page.goto('/dev.html?dev=1&task=gramophone');await expect(page.locator('.gramophone-disc[data-record="boris.mp3"]')).toBeDisabled();await expect(page.getByRole('button',{name:'Конверт: Борис Годунов'})).toBeDisabled();
 expect(errors).toEqual([]);
});
