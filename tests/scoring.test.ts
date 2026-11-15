import { describe, expect, it } from 'vitest';
import { calcPoints, hintCostPercent } from '../src/engine/scoring';

describe('подсчёт очков', () => {
  it('даёт базовые 100 очков без ошибок и подсказок', () => expect(calcPoints(0,0)).toBe(100));
  it('снимает десять очков за неверную попытку', () => expect(calcPoints(1,0)).toBe(90));
  it('учитывает несколько неверных попыток', () => expect(calcPoints(3,0)).toBe(70));
  it('не опускает награду ниже двадцати очков', () => expect(calcPoints(20,0)).toBe(20));
  it('уменьшает награду на четверть после первой подсказки', () => expect(calcPoints(0,1)).toBe(75));
  it('уменьшает награду на сорок процентов после второй подсказки', () => expect(calcPoints(0,2)).toBe(60));
  it('уменьшает награду наполовину после третьей подсказки', () => expect(calcPoints(0,3)).toBe(50));
  it('первая шахматная подсказка стоит половину базовых очков', () => expect(calcPoints(0,1,'chess')).toBe(50));
  it('сочетает штраф за ошибки с ценой подсказки', () => expect(calcPoints(2,1)).toBe(55));
  it('сообщает размер цены подсказки', () => expect([1,2,3].map((n)=>hintCostPercent(n))).toEqual([25,40,50]));
});
