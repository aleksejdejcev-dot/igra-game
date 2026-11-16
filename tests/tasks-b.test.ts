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
   expect(entry.answer).toMatch(/^[А-ЯЁ]+$/);
   const painting=paintings.find(p=>p.id===entry.paintingId)!;
   if(entry.paintingId==='p03')expect(painting.title.toLocaleUpperCase('ru')).toContain(entry.answer);
   if(['p06','p40','p08','p21','p28'].includes(entry.paintingId))expect(painting.title.toLocaleUpperCase('ru')).toContain(entry.answer==='КОЛЫЧЁВ'?'КОЛЫЧЕВ':entry.answer);
   expect(entry.answer.length).toBeGreaterThan(0);
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
