export interface LeaderboardRecord {
  name: string;
  score: number;
  date?: string;
  createdAt?: string;
}

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LeaderboardResult {
  records: LeaderboardRecord[];
  source: 'remote' | 'local';
}

const STORAGE_KEY = 'closed-gallery-leaderboard-v1';
const API_PATH = 'api/leaderboard.php';

function validRecords(value: unknown): LeaderboardRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is LeaderboardRecord => Boolean(
      item && typeof item === 'object'
      && typeof (item as LeaderboardRecord).name === 'string'
      && Number.isFinite((item as LeaderboardRecord).score),
    ))
    .map(({ name, score, date, createdAt }) => ({
      name: Array.from(name).slice(0, 24).join(''),
      score: Math.max(0, Math.trunc(score)),
      ...(typeof date === 'string' ? { date } : typeof createdAt === 'string' ? { date: createdAt } : {}),
      ...(typeof createdAt === 'string' ? { createdAt } : {}),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function browserStorage(): StoragePort | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createLeaderboard(options: {
  baseUrl?: string;
  fetcher?: typeof fetch;
  storage?: StoragePort | null;
} = {}) {
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const fetcher = options.fetcher ?? fetch.bind(globalThis);
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const endpoint = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${API_PATH}`;

  const readLocal = (): LeaderboardRecord[] => {
    try {
      const value = storage?.getItem(STORAGE_KEY);
      return value ? validRecords(JSON.parse(value)) : [];
    } catch {
      return [];
    }
  };

  const writeLocal = (records: LeaderboardRecord[]) => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(validRecords(records)));
    } catch {
      // Private browsing or a full storage quota leaves the in-memory flow usable.
    }
  };

  return {
    async list(): Promise<LeaderboardResult> {
      try {
        const response = await fetcher(endpoint, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object' || !('records' in payload)) {
          throw new Error('Leaderboard response has no records field');
        }
        return { records: validRecords(payload.records), source: 'remote' };
      } catch {
        return { records: readLocal(), source: 'local' };
      }
    },

    async submit(record: LeaderboardRecord): Promise<LeaderboardResult> {
      const cleanRecord = validRecords([{ ...record, date: record.date ?? record.createdAt ?? new Date().toISOString() }])[0];
      if (!cleanRecord) return this.list();
      writeLocal([...readLocal(), cleanRecord]);
      try {
        const response = await fetcher(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: cleanRecord.name, score: cleanRecord.score }),
        });
        if (!response.ok) throw new Error(`Leaderboard returned ${response.status}`);
        return this.list();
      } catch {
        const records = readLocal();
        writeLocal(records);
        return { records, source: 'local' };
      }
    },
  };
}
