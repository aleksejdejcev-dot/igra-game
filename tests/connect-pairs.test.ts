import { describe, expect, it } from 'vitest';
import { CONNECT_PAIRS, isCorrectConnection } from '../src/tasks/connect-pairs';

describe('связи портретов',()=>{
 it('сопоставляет три пары из редакционного задания независимо от порядка',()=>{for(const [a,b] of CONNECT_PAIRS){expect(isCorrectConnection(a,b)).toBe(true);expect(isCorrectConnection(b,a)).toBe(true);}});
 it('отклоняет посторонние сочетания',()=>{expect(isCorrectConnection('mussorgsky','lermontov')).toBe(false);});
});
