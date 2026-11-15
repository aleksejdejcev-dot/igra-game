import { describe, expect, it, vi } from 'vitest';
import { createLeaderboard, type StoragePort } from '../src/engine/leaderboard';

function memoryStorage(): StoragePort {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

describe('leaderboard', () => {
  it('falls back to localStorage and marks local records with dates', async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('API unavailable'));
    const board = createLeaderboard({ baseUrl: '/', fetcher, storage });

    const result = await board.submit({ name: 'Корреспондент', score: 87 });

    expect(result.source).toBe('local');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].date).toMatch(/^\d{4}-/u);
    expect((await board.list()).source).toBe('local');
  });

  it('normalizes records to 24 Unicode characters and keeps API dates', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ records: [
      { name: '🙂'.repeat(30), score: 12, date: '1898-01-01T00:00:00Z' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const result = await createLeaderboard({ fetcher, storage: null }).list();

    expect(result.source).toBe('remote');
    expect(Array.from(result.records[0].name)).toHaveLength(24);
    expect(result.records[0].date).toBe('1898-01-01T00:00:00Z');
  });
});
