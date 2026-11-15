import { describe,expect,it } from 'vitest';
import halls from '../src/data/halls.json';
import { hallCompletionCount,hallsEligibleToUnlock } from '../src/engine/progression';
import type { Hall } from '../src/ui/types';

const data=halls as Hall[];
describe('открытие залов и ветвей',()=>{
 it('проходит начальную цепочку, затем открывает шесть самостоятельных ветвей',()=>{
  expect(hallsEligibleToUnlock(data,{})).toEqual(['h01']);
  const solved={memo:{points:100},puzzle:{points:100},'match-captions':{points:100},'crossword-names':{points:100},'crossword-authors':{points:100},'fill-words-repnin':{points:100}};
  expect(hallsEligibleToUnlock(data,solved)).toEqual(['h01','h02','h03','h04','h05','h06','h07','h08','h09','h10']);
 });
 it('открывает финал после любых восьми из десяти залов',()=>{
  const solved:Record<string,{points:number}>={};for(const id of ['memo','puzzle','match-captions','crossword-names','crossword-authors','fill-words-repnin','combo-lock','split-names','chess','fill-words-monument'])solved[id]={points:100};
  expect(hallCompletionCount(data,solved)).toBe(8);expect(hallsEligibleToUnlock(data,solved)).toContain('h11');
 });
 it('не считает незавершённый зал решённым',()=>{const solved={'crossword-authors':{points:100}};expect(hallCompletionCount(data,solved)).toBe(0);});
});
