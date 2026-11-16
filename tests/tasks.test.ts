import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeWord } from '../src/tasks/shared';
import { GameStore } from '../src/engine/state';
import { taskApi } from '../src/engine/tasks';

describe('модули заданий',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('считает е и ё, регистр и крайние пробелы равными',()=>expect(normalizeWord('  ХОРОВОДЁМ  ')).toBe('хороводем'));
  it('передаёт ошибки и использованную подсказку в расчёт награды',async()=>{
    const store=new GameStore();const api=taskApi('memo','memo',store,async(id)=>{store.addHint(id);return 'записка';});
    api.attempt(false);api.attempt(false);expect(await api.useHint(1)).toBe('записка');api.attempt(true);api.solve();
    expect(store.state.solvedTasks.memo.points).toBe(55);
  });
  it('сохраняет и восстанавливает черновик задания в локальном хранилище',()=>{
    const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
    const store=new GameStore();const api=taskApi('fill-words-repnin','fill-words-repnin',store,async()=>null);
    api.saveDraft({answers:['хоровод','окружил']});
    const reopened=taskApi('fill-words-repnin','fill-words-repnin',store,async()=>null);
    expect(reopened.loadDraft({answers:[]})).toEqual({answers:['хоровод','окружил']});
  });
});
