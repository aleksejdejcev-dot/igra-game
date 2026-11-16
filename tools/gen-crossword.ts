import { writeFileSync } from 'node:fs';

type Direction = 'across' | 'down';
type Entry = { answer: string; paintingId: string; revealed?: boolean; row: number; col: number; direction: Direction };
type Crossword = { entries: Entry[]; grid: (string | null)[][]; score: number };
type Word = readonly [answer: string, paintingId: string, revealed?: boolean];
type SetConfig = { id: string; rows: Word[] };

const sets: Record<string, SetConfig> = {
  names: { id: 'crossword-names', rows: [['ГРОЗНЫЙ', 'p03', true], ['КОЛЫЧЁВ', 'p06'], ['СКУРАТОВ', 'p40'], ['САЛОС', 'p08'], ['МОРОЗОВ', 'p21'], ['ФИЛИПП', 'p28']] },
  authors: { id: 'crossword-authors', rows: [['ПУКИРЕВ', 'p34', true], ['НЕВРЕВ', 'p24'], ['НОВОСКОЛЬЦЕВ', 'p30'], ['РЯБУШКИН', 'p39'], ['МЯСОЕДОВ', 'p23'], ['МАКОВСКИЙ', 'p18'], ['ЛЕБЕДЕВ', 'p10'], ['НЕСТЕРОВ', 'p29']] },
};

function cells(entry: Entry) {
  return Array.from({ length: entry.answer.length }, (_, index) => [
    entry.row + (entry.direction === 'down' ? index : 0),
    entry.col + (entry.direction === 'across' ? index : 0),
    entry.answer[index],
  ] as const);
}

function bounds(entries: Entry[]) {
  const minRow = Math.min(...entries.map((entry) => entry.row));
  const maxRow = Math.max(...entries.map((entry) => entry.row + (entry.direction === 'down' ? entry.answer.length - 1 : 0)));
  const minCol = Math.min(...entries.map((entry) => entry.col));
  const maxCol = Math.max(...entries.map((entry) => entry.col + (entry.direction === 'across' ? entry.answer.length - 1 : 0)));
  return { minRow, maxRow, minCol, maxCol, width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
}

function render(entries: Entry[]): (string | null)[][] {
  const box = bounds(entries);
  const grid = Array.from({ length: box.height }, () => Array<string | null>(box.width).fill(null));
  for (const entry of entries) for (const [row, col, letter] of cells(entry)) {
    const y = row - box.minRow;
    const x = col - box.minCol;
    if (grid[y][x] !== null && grid[y][x] !== letter) throw new Error(`Конфликт букв в ${entry.answer}`);
    grid[y][x] = letter;
  }
  return grid;
}

function canPlace(entries: Entry[], candidate: Entry): boolean {
  const occupied = new Map<string, { letter: string; direction: Direction }>();
  for (const entry of entries) for (const [row, col, letter] of cells(entry)) occupied.set(`${row},${col}`, { letter, direction: entry.direction });
  let crossings = 0;
  for (const [row, col, letter] of cells(candidate)) {
    const existing = occupied.get(`${row},${col}`);
    if (existing) {
      if (existing.letter !== letter || existing.direction === candidate.direction) return false;
      crossings++;
      continue;
    }
    // In a crossword, unrelated words may not touch side by side.
    const sideCells = candidate.direction === 'across' ? [[row - 1, col], [row + 1, col]] : [[row, col - 1], [row, col + 1]];
    if (sideCells.some(([r, c]) => occupied.has(`${r},${c}`))) return false;
  }
  if (crossings === 0) return false;
  const step = candidate.direction === 'across' ? [0, 1] : [1, 0];
  const before = [candidate.row - step[0], candidate.col - step[1]];
  const after = [candidate.row + step[0] * candidate.answer.length, candidate.col + step[1] * candidate.answer.length];
  return !occupied.has(`${before[0]},${before[1]}`) && !occupied.has(`${after[0]},${after[1]}`);
}

function layout(words: Word[]): Crossword {
  const ordered = [...words].sort((a, b) => Number(Boolean(b[2])) - Number(Boolean(a[2])) || b[0].length - a[0].length);
  let beam: Entry[][] = [[{ answer: ordered[0][0], paintingId: ordered[0][1], revealed: ordered[0][2], row: 0, col: 0, direction: 'across' }]];
  const remaining = ordered.slice(1);

  for (let depth = 0; depth < remaining.length; depth++) {
    const candidates: { entries: Entry[]; score: number; key: string }[] = [];
    for (const entries of beam) {
      const placed = new Set(entries.map((entry) => entry.answer));
      for (const [answer, paintingId, revealed] of remaining) {
        if (placed.has(answer)) continue;
        for (const direction of ['across', 'down'] as const) {
          for (const existing of entries) {
            if (existing.direction === direction) continue;
            for (const [crossRow, crossCol, crossLetter] of cells(existing)) {
              for (let index = 0; index < answer.length; index++) {
                if (answer[index] !== crossLetter) continue;
                const candidate: Entry = {
                  answer, paintingId, revealed,
                  row: crossRow - (direction === 'down' ? index : 0),
                  col: crossCol - (direction === 'across' ? index : 0),
                  direction,
                };
                if (!canPlace(entries, candidate)) continue;
                const next = [...entries, candidate];
                const box = bounds(next);
                const score = box.width * box.height + (box.width + box.height) * 0.25 - next.length * 0.15;
                const key = next.map((entry) => `${entry.answer}:${entry.row}:${entry.col}:${entry.direction}`).sort().join('|');
                candidates.push({ entries: next, score, key });
              }
            }
          }
        }
      }
    }
    if (candidates.length === 0) throw new Error(`Не удалось связать все слова; застряли: ${remaining.map(([word]) => word).join(', ')}`);
    candidates.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key, 'ru'));
    // Beam search avoids the greedy dead ends that produced disconnected layouts.
    beam = candidates.filter((item, index) => index === 0 || item.key !== candidates[index - 1].key).slice(0, 500).map((item) => item.entries);
  }

  const best = beam.map((entries) => ({ entries, ...bounds(entries) })).sort((a, b) => a.width * a.height - b.width * b.height || a.height - b.height)[0];
  const entries = best.entries.map((entry) => ({ ...entry, row: entry.row - best.minRow, col: entry.col - best.minCol }));
  return { entries, grid: render(entries), score: best.width * best.height };
}

for (const [name, set] of Object.entries(sets)) {
  const { entries, grid } = layout(set.rows);
  const inputOrder = new Map(set.rows.map(([answer], index) => [answer, index]));
  entries.sort((a, b) => (inputOrder.get(a.answer) ?? 0) - (inputOrder.get(b.answer) ?? 0));
  writeFileSync(`src/data/crossword-${name}.json`, `${JSON.stringify({ taskId: set.id, width: grid[0].length, height: grid.length, entries, grid }, null, 2)}\n`);
  console.log(`${name}: ${grid[0].length}×${grid.length}`);
}
