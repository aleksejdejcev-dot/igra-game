import { describe, expect, it } from 'vitest';
import paintings from '../src/data/paintings.json';

describe('каталог картин', () => {
  it('загружается в виде массива', () => {
    expect(Array.isArray(paintings)).toBe(true);
  });
});
