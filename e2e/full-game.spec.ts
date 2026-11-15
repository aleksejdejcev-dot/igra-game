import { expect,test } from '@playwright/test';

test('корреспондент проходит от письма редактора до редакционной записки',async({page})=>{
 const posted:{name:string;score:number}[]=[];
 await page.route('**/api/leaderboard.php',async route=>{
  if(route.request().method()==='POST'){const record=route.request().postDataJSON() as {name:string;score:number};posted.push(record);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({records:[{...record,createdAt:'1898-01-01T00:00:00Z'}]})});}
  else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({records:posted})});
 });
 await page.goto('/?dev=1');
 await expect(page.locator('.start-records h2')).toHaveText('Книга рекордов');await expect(page.locator('.start-records-table .leaderboard-source')).toHaveText('Общая книга рекордов');
 await page.locator('[name="name"]').fill('Корреспондент НЭТИ');await page.getByRole('button',{name:'Войти в галерею'}).click();
 await expect(page.locator('.hall-caption b')).toHaveText('Вестибюль');
 const complete=async(ids:string[])=>{await page.evaluate(values=>{for(const id of values)window.__GAME_TEST__?.completeTask(id);},ids);};
 const visit=async(id:string)=>{await page.locator('.map-open').click();await page.locator(`[data-hall-link="${id}"]`).click();await expect(page.locator('.hall-caption b')).toHaveText(/.+/);};
 await complete(['memo','puzzle']);await visit('h02');await complete(['match-captions']);
 await visit('h03');await complete(['crossword-names']);
 await visit('h04');await complete(['crossword-authors','fill-words-repnin']);
 const branches=await page.locator('.map-open').evaluate(async button=>{(button as HTMLButtonElement).click();return [...document.querySelectorAll<SVGElement>('.map-room.is-open')].map(room=>room.dataset.hallLink);});
 expect(branches).toEqual(expect.arrayContaining(['h05','h06','h07','h08','h09','h10']));expect(branches).not.toContain('h11');await page.keyboard.press('Escape');
 await complete(['combo-lock','split-names','chess','fill-words-monument']);
 await page.locator('.map-open').click();await page.locator('[data-hall-link="h11"]').click();
 await page.evaluate(()=>window.__GAME_TEST__?.openFinale());
 await expect(page.locator('.finale-dialog')).toBeVisible();await expect(page.locator('.finale-painting-grid .finale-painting')).toHaveCount(50);
 await page.evaluate(()=>{let index=0;while(document.querySelector('.finale-painting-grid .finale-painting')){document.querySelector<HTMLButtonElement>('.finale-painting-grid .finale-painting')!.click();document.querySelectorAll<HTMLButtonElement>('.finale-theme-button')[index%6].click();index++;}});
 await page.getByRole('button',{name:'К редакционным итогам'}).click();await expect(page.locator('.finale-statistics')).toBeVisible();
 await page.getByRole('button',{name:'К вопросу редактора'}).click();await page.locator('[name="editorial-response"]').fill('Ответ остаётся личным размышлением корреспондента.');
 await page.getByRole('button',{name:'Оставить записку в редакции'}).click();
 await expect(page.getByText('Выставка закрыта. Статья готова')).toBeVisible();await expect(page.locator('.finale-final-score')).toHaveText('Счёт корреспондента: 1000');
 await expect(page.locator('.finale-leaderboard tbody tr')).toHaveCount(1);expect(posted).toEqual([{name:'Корреспондент НЭТИ',score:1000}]);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('closed-exhibition-1898:save-v1')!).finaleResponse)).toBe('Ответ остаётся личным размышлением корреспондента.');
});
