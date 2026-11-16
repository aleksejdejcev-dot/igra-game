import { afterEach, describe, expect, it, vi } from 'vitest';
import halls from '../src/data/halls.json';
import type { Hall } from '../src/ui/types';
import { GameStore } from '../src/engine/state';

describe('загрузка сохранённого прогресса',()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it('не оставляет открытыми залы, если в старой записи нет решённых заданий',()=>{
    const rows=new Map<string,string>([['closed-exhibition-1898:save-v1',JSON.stringify({
      player:{name:'Корреспондент'},unlockedHalls:(halls as Hall[]).map(hall=>hall.id),solvedTasks:{},
      visitedPaintings:[],readParagraphs:[],finaleResponse:null,
    })]]);
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>rows.set(key,value),
      removeItem:(key:string)=>rows.delete(key),key:(index:number)=>[...rows.keys()][index]??null,
      get length(){return rows.size;},
    });
    expect(new GameStore().state.unlockedHalls).toEqual(['h01']);
  });

  it('сохраняет только залы, доступные по решённым заданиям',()=>{
    const solvedTasks={memo:{points:100,attempts:1,hintsUsed:0},puzzle:{points:100,attempts:1,hintsUsed:0}};
    const rows=new Map<string,string>([['closed-exhibition-1898:save-v1',JSON.stringify({
      player:{name:'Корреспондент'},unlockedHalls:['h01','h02','h03','h04','h05','h06','h07','h08','h09','h10','h11'],solvedTasks,
      visitedPaintings:[],readParagraphs:[],finaleResponse:null,
    })]]);
    vi.stubGlobal('localStorage',{getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>rows.set(key,value),removeItem:(key:string)=>rows.delete(key),key:(index:number)=>[...rows.keys()][index]??null,get length(){return rows.size;}});
    expect(new GameStore().state.unlockedHalls).toEqual(['h01','h02']);
  });
});
