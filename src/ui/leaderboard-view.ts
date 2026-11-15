import type { LeaderboardResult } from '../engine/leaderboard';

export function renderLeaderboard(container: HTMLElement, result: LeaderboardResult): void {
  container.replaceChildren();
  const source = document.createElement('p');
  source.className = 'leaderboard-source';
  source.setAttribute('role', 'status');
  source.textContent = result.source === 'local' ? 'Локальный рекорд · хранится в этом браузере' : 'Общая книга рекордов';
  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  for (const label of ['Место', 'Корреспондент', 'Счёт', 'Дата']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  }
  head.append(header);
  const body = document.createElement('tbody');
  result.records.slice(0, 20).forEach((record, index) => {
    const row = document.createElement('tr');
    const date = record.date ?? record.createdAt;
    const values = [String(index + 1), record.name, String(record.score), date ? formatDate(date) : '—'];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  });
  if (!result.records.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'В книге пока нет записей.';
    row.append(cell);
    body.append(row);
  }
  table.append(head, body);
  container.append(source, table);
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(timestamp) : '—';
}
