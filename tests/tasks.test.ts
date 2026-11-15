import { describe, expect, it } from 'vitest';
import { normalizeWord } from '../src/tasks/shared';
import { GameStore } from '../src/engine/state';
import { taskApi } from '../src/engine/tasks';

describe('модули заданий',()=>{
  it('считает е и ё, регистр и крайние пробелы равными',()=>expect(normalizeWord('  ХОРОВОДЁМ  ')).toBe('хороводем'));
  it('передаёт ошибки и использованную подсказку в расчёт награды',async()=>{
    const store=new GameStore();const api=taskApi('memo','memo',store,async(id)=>{store.addHint(id);return 'записка';});
    api.attempt(false);api.attempt(false);expect(await api.useHint(1)).toBe('записка');api.attempt(true);api.solve();
    expect(store.state.solvedTasks.memo.points).toBe(55);
  });
});
