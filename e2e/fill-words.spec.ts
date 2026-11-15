import { expect,test } from '@playwright/test';
test.use({deviceScaleFactor:2});
test('восемь пропусков Репнина принимают слова, монумент сверяется с первичными текстами',async({page})=>{
  await page.goto('/dev.html?dev=1&task=fill-words-repnin');await expect(page.locator('.poem-text p')).toHaveCount(46);await expect(page.locator('.fill-word')).toHaveCount(8);await page.screenshot({path:'tools/shots/tasks-a/fill-words-repnin.png'});
  for(const [index,answer] of ['хоровод','окружил','плясать','раб','день','встарь','час','пал'].entries()){const field=page.locator('.fill-word').nth(index);await field.fill(answer.toLocaleUpperCase('ru'));await field.press('Enter');await expect(field).toBeDisabled();}
  await expect(page.locator('.task-result-seal')).toContainText('Печать редакции поставлена');
  await page.goto('/dev.html?dev=1&task=fill-words-monument');await expect(page.locator('.fill-name-field input')).toHaveCount(3);await expect(page.locator('.monument-image')).toBeVisible();await expect(page.locator('.monument-source p')).toHaveCount(2);await page.screenshot({path:'tools/shots/tasks-a/fill-words-monument.png'});
  for(const [index,name] of ['Сильвестр','Анастасия','Адашев'].entries()){const field=page.locator('.fill-name-field input').nth(index);await field.fill(name);await field.press('Enter');await expect(field).toBeDisabled();}
  await expect(page.locator('.task-result-seal')).toContainText('Печать редакции поставлена');
});
