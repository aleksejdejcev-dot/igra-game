import { describe, expect, it } from 'vitest';
import paintings from '../src/data/paintings.json';
import zones from '../src/data/zones.json';
import names from '../src/data/crossword-names.json';
import authors from '../src/data/crossword-authors.json';
import { normalizeWord } from '../src/tasks/shared';
import { pointInPolygon } from '../src/tasks/polygon';
import { isCombinationCorrect } from '../src/tasks/combo-lock';
import tasks from '../src/data/tasks.json';

describe('новые задания выставки',()=>{
 it('содержит обязательные ответы кроссвордов и реальные картинки-подсказки',()=>{
  expect(names.entries.map(item=>item.answer)).toEqual(['ГРОЗНЫЙ','КОЛЫЧЁВ','СКУРАТОВ','САЛОС','МОРОЗОВ','ФИЛИПП']);
  expect(authors.entries.map(item=>item.answer)).toEqual(['ПУКИРЕВ','НЕВРЕВ','НОВОСКОЛЬЦЕВ','РЯБУШКИН','МЯСОЕДОВ','МАКОВСКИЙ','ЛЕБЕДЕВ','НЕСТЕРОВ']);
  for(const item of [...names.entries,...authors.entries])expect(paintings.some(p=>p.id===item.paintingId)).toBe(true);
  for(const item of authors.entries){const painting=paintings.find(p=>p.id===item.paintingId)!;expect(painting.artist.toLocaleUpperCase('ru')).toContain(item.answer);}
  for(const entry of [...names.entries,...authors.entries]){
   expect(entry.row).toBeGreaterThanOrEqual(0);expect(entry.col).toBeGreaterThanOrEqual(0);
   expect(entry.row+(entry.direction==='down'?entry.answer.length:0)).toBeLessThanOrEqual((names.entries.includes(entry)?names:authors).height);
   expect(entry.col+(entry.direction==='across'?entry.answer.length:0)).toBeLessThanOrEqual((names.entries.includes(entry)?names:authors).width);
   for(let i=0;i<entry.answer.length;i++){const row=entry.row+(entry.direction==='down'?i:0),col=entry.col+(entry.direction==='across'?i:0);expect((names.entries.includes(entry)?names:authors).grid[row][col]).toBe(entry.answer[i]);}
   expect(entry.answer).toMatch(/^[А-ЯЁ]+$/);
   const painting=paintings.find(p=>p.id===entry.paintingId)!;
   if(entry.paintingId==='p03')expect(painting.title.toLocaleUpperCase('ru')).toContain(entry.answer);
   if(['p06','p40','p08','p21','p28'].includes(entry.paintingId))expect(painting.title.toLocaleUpperCase('ru')).toContain(entry.answer==='КОЛЫЧЁВ'?'КОЛЫЧЕВ':entry.answer);
   if(entry.paintingId==='p06')expect(painting.title.toLocaleUpperCase('ru')).toContain('КОЛЫЧЕВ');
   if(['p24','p30','p39','p23','p18','p10','p29'].includes(entry.paintingId))expect(painting.artist.toLocaleUpperCase('ru')).toContain(entry.answer);
   expect(entry.answer.length).toBeGreaterThan(0);
  }
 });
 it('строит оба кроссворда как одну корректную сеть пересекающихся слов',()=>{
  for(const crossword of [names,authors]){
   const belongs=(entry:typeof crossword.entries[number],row:number,col:number)=>Array.from({length:entry.answer.length},(_,i)=>[entry.row+(entry.direction==='down'?i:0),entry.col+(entry.direction==='across'?i:0)]).some(([r,c])=>r===row&&c===col);
   const crossings=(a:typeof crossword.entries[number],b:typeof crossword.entries[number])=>Array.from({length:a.answer.length},(_,i)=>[a.row+(a.direction==='down'?i:0),a.col+(a.direction==='across'?i:0),a.answer[i]] as const).some(([r,c,l])=>Array.from({length:b.answer.length},(_,j)=>[b.row+(b.direction==='down'?j:0),b.col+(b.direction==='across'?j:0),b.answer[j]] as const).some(([rr,cc,ll])=>r===rr&&c===cc&&l===ll));
   const connected=new Set<number>([0]);let changed=true;while(changed){changed=false;for(let i=0;i<crossword.entries.length;i++)if(!connected.has(i)&&[...connected].some(j=>crossings(crossword.entries[i],crossword.entries[j]))){connected.add(i);changed=true;}}
   expect(connected.size).toBe(crossword.entries.length);
   expect(crossword.grid).toHaveLength(crossword.height);
   expect(crossword.grid.every(row=>row.length===crossword.width)).toBe(true);
   for(let row=0;row<crossword.height;row++)for(let col=0;col<crossword.width;col++){
    const letter=crossword.grid[row][col];if(letter===null)continue;
    const across=crossword.entries.some(entry=>entry.direction==='across'&&belongs(entry,row,col));
    const down=crossword.entries.some(entry=>entry.direction==='down'&&belongs(entry,row,col));
    if(col+1<crossword.width&&crossword.grid[row][col+1]!==null)expect(across&&crossword.entries.some(entry=>entry.direction==='across'&&belongs(entry,row,col+1))).toBe(true);
    if(row+1<crossword.height&&crossword.grid[row+1][col]!==null)expect(down&&crossword.entries.some(entry=>entry.direction==='down'&&belongs(entry,row+1,col))).toBe(true);
   }
  }
 });
 it('открывает карусель только в сочетании Геллер—Пелевин—Мясоедов',()=>{expect(isCombinationCorrect(['p08','p32','p23'],['p08','p32','p23'])).toBe(true);expect(isCombinationCorrect(['p08','p21','p23'],['p08','p32','p23'])).toBe(false);});
 it('нормализует ё и регистр во всех словесных заданиях',()=>expect(normalizeWord('Фёдоров')).toBe(normalizeWord('ФЕДОРОВ')));
 it('принимает только зоны внутри указанных полигонов',()=>{
  for(const zone of [zones.zones.crown,zones.zones.figure]){
   const polygon=zone.points.map(([x,y])=>({x,y}));
   const center={x:polygon.reduce((n,p)=>n+p.x,0)/polygon.length,y:polygon.reduce((n,p)=>n+p.y,0)/polygon.length};
   expect(pointInPolygon(center,polygon)).toBe(true);expect(pointInPolygon({x:-1,y:-1},polygon)).toBe(false);
  }
 });
 it('связывает задания с залами и конфигурацией',()=>{
  for(const id of ['crossword-names','crossword-authors','split-names','drag-crown','drag-figure','combo-lock'])expect(tasks.some(task=>task.id===id)).toBe(true);
 });
});
