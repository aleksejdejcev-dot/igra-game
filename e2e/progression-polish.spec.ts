import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('старое сохранение не открывает залы без решённых дел',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('closed-exhibition-1898:save-v1',JSON.stringify({
    player:{name:'Корреспондент'},unlockedHalls:['h01','h02','h03','h04','h05','h06','h07','h08','h09','h10','h11'],
    solvedTasks:{},totalScore:0,visitedPaintings:[],readParagraphs:[],finaleResponse:null,
  })));
  await page.goto('/?dev=1#hall/h09');
  await expect(page.locator('.hall-caption b')).toHaveText('Вестибюль');
  const unlocked=await page.evaluate(()=>JSON.parse(localStorage.getItem('closed-exhibition-1898:save-v1')!).unlockedHalls);
  expect(unlocked).toEqual(['h01']);
});

test('обложки граммофонной комнаты закреплены на стене',async({page})=>{
  await mkdir('tools/shots/h09',{recursive:true});
  const solvedTasks=Object.fromEntries(['memo','puzzle','match-captions','crossword-names','crossword-authors','fill-words-repnin'].map(id=>[id,{points:100,attempts:1,hintsUsed:0}]));
  await page.addInitScript((solved)=>localStorage.setItem('closed-exhibition-1898:save-v1',JSON.stringify({
    player:{name:'Корреспондент'},unlockedHalls:['h01','h02','h03','h04','h05','h06','h07','h08','h09','h10'],
    solvedTasks:solved,totalScore:600,visitedPaintings:[],readParagraphs:[],finaleResponse:null,
  })),solvedTasks);
  await page.goto('/?dev=1#hall/h09');await expect(page.locator('.hall-caption b')).toHaveText('Граммофонная комната');
  await page.waitForTimeout(500);await page.evaluate(()=>window.__WORLD_TEST__?.setAngles(0,0));
  await page.locator('.gallery-canvas').screenshot({path:'tools/shots/h09/book-covers-wall.png'});
});

test('зал Филиппа больше не закрыт подвесными панелями и лампами',async({page})=>{
  await mkdir('tools/shots/h03',{recursive:true});
  const solvedTasks=Object.fromEntries(['memo','puzzle','match-captions'].map(id=>[id,{points:100,attempts:1,hintsUsed:0}]));
  await page.addInitScript((solved)=>localStorage.setItem('closed-exhibition-1898:save-v1',JSON.stringify({
    player:{name:'Корреспондент'},unlockedHalls:['h01','h02','h03'],solvedTasks:solved,totalScore:300,
    visitedPaintings:[],readParagraphs:[],finaleResponse:null,
  })),solvedTasks);
  await page.goto('/?dev=1#hall/h03');await expect(page.locator('.hall-caption b')).toHaveText('«Митрополит Филипп»');
  await page.waitForTimeout(500);await page.evaluate(()=>window.__WORLD_TEST__?.setAngles(0,0));
  await page.locator('.gallery-canvas').screenshot({path:'tools/shots/h03/polished.png'});
});

test('раскладка редакционной папки переживает закрытие и повторное открытие',async({page})=>{
  const ids=['memo','puzzle','match-captions','crossword-names','crossword-authors','fill-words-repnin','combo-lock','split-names','chess','fill-words-monument','gramophone','connect-pairs','drag-crown','drag-figure'];
  const solved=Object.fromEntries(ids.map(id=>[id,{points:100,attempts:1,hintsUsed:0}]));
  await page.addInitScript(state=>localStorage.setItem('closed-exhibition-1898:save-v1',JSON.stringify(state)),{
    player:{name:'Корреспондент'},unlockedHalls:['h01','h02','h03','h04','h05','h06','h07','h08','h09','h10'],
    solvedTasks:solved,totalScore:1400,visitedPaintings:[],readParagraphs:[],finaleResponse:null,
  });
  await page.goto('/?dev=1');await page.waitForFunction(()=>Boolean(window.__GAME_TEST__));
  await page.evaluate(()=>window.__GAME_TEST__?.openFinale());
  const dialog=page.locator('.finale-dialog');await expect(dialog).toBeVisible();
  const card=dialog.locator('.finale-painting-grid .finale-painting').first();const id=await card.getAttribute('data-painting-id');
  await card.click();await dialog.locator('.finale-theme-button').first().click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('closed-exhibition-1898:task-draft:finale')!).length)).toBe(1);
  await dialog.locator('.dialog-head .icon-button').click();await expect(dialog).toHaveCount(0);
  await page.evaluate(()=>window.__GAME_TEST__?.openFinale());
  await expect(dialog.locator(`.finale-painting-grid [data-painting-id="${id}"]`)).toHaveCount(0);
  await expect(dialog.locator(`.finale-folder-paintings [data-painting-id="${id}"]`)).toHaveCount(1);
});
