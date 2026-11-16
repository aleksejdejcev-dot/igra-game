import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const ids=['crossword-names','crossword-authors','split-names','drag-crown','drag-figure','combo-lock'];
test('шесть заданий из новой серии доступны в пробной полосе',async({page})=>{
 await mkdir('tools/shots/tasks-b',{recursive:true});
 const paintings=JSON.parse(await readFile('src/data/paintings.json','utf8')) as {id:string;caption:string;artistShort:string}[];
 const names=JSON.parse(await readFile('src/data/crossword-names.json','utf8')) as {entries:{answer:string;row:number;col:number;direction:'across'|'down'}[]};
 for(const id of ids){
  await page.goto(`/dev.html?dev=1&task=${id}`);
  const dialog=page.locator('.dev-task-dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('.task-frame-head h2')).not.toBeEmpty();
  if(id.startsWith('crossword-')){
   await expect(dialog.locator('.crossword-cell').first()).toBeVisible();
   const data=JSON.parse(await readFile(`src/data/${id}.json`,'utf8')) as {width:number;height:number;entries:{answer:string;paintingId:string}[]};
   await expect(dialog.locator('.crossword-clue')).toHaveCount(data.entries.length);
   for(const [index,entry] of data.entries.entries()){
    const painting=paintings.find(item=>item.id===entry.paintingId)!;
    const caption=dialog.locator('.crossword-clue').nth(index).locator('.crossword-painting-title');
    await expect(caption).toHaveAttribute('title',painting.caption);
    const visibleCaption=(await caption.textContent()??'').toLocaleLowerCase('ru').replaceAll('ё','е');
    if(id==='crossword-names')expect(visibleCaption).toContain(entry.answer.toLocaleLowerCase('ru').replaceAll('ё','е'));
    else expect(visibleCaption).toContain(entry.answer.toLocaleLowerCase('ru'));
   }
   const trackFits=await dialog.locator('.crossword-layout').evaluate(layout=>{const board=layout.querySelector('.crossword-board')!.getBoundingClientRect();const firstTrack=parseFloat(getComputedStyle(layout).gridTemplateColumns);return board.width<=firstTrack+1;});
   expect(trackFits).toBe(true);
  }
  if(id==='split-names')await expect(dialog.locator('.split-name-card')).toHaveCount(3);
  if(id.startsWith('drag-'))await expect(dialog.locator('.icon-drop')).toHaveCount(id==='drag-crown'?1:2);
  if(id==='combo-lock'){
   await dialog.getByRole('button',{name:'Следующее изображение, окно 2'}).click();
   await dialog.getByRole('button',{name:'Следующее изображение, окно 3'}).click();
   await dialog.getByRole('button',{name:'Следующее изображение, окно 3'}).click();
   await expect(dialog.locator('.combo-click')).toBeVisible();
  }
  await page.screenshot({path:`tools/shots/tasks-b/${id}.png`});
  if(id==='crossword-names'){
   for(const entry of names.entries.slice(1)){
    for(let offset=0;offset<entry.answer.length;offset++){
     const row=entry.row+(entry.direction==='down'?offset:0),col=entry.col+(entry.direction==='across'?offset:0);
     const cell=dialog.locator(`[aria-label="Буква, строка ${row+1}, столбец ${col+1}"]`);
     if(!await cell.isDisabled())await cell.fill(entry.answer[offset]);
    }
   }
   await expect(dialog.locator('.task-result-seal')).toBeVisible();
  }
 }
});
