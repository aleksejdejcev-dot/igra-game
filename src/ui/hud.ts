import type { GameState } from '../engine/state';

export function hudMarkup(state: GameState): string {
  return `<header class="hud">
    <a class="wordmark" href="#hall/h01" aria-label="Вестибюль закрытой выставки">Закрытая выставка <span>1898</span></a>
    <div class="hud-right">
      <span class="visitor">Корреспондент: <b data-player></b></span>
      <span class="score">Счёт <b data-score>${state.totalScore}</b></span>
      <button class="icon-button map-open" type="button" aria-label="План галереи" title="План галереи">⌖</button>
      <button class="icon-button hint-open" type="button" aria-label="Заметки на полях" title="Заметки на полях">✦</button>
      <button class="icon-button settings-open" type="button" aria-label="Настройки журнала" title="Настройки журнала">⚙</button>
    </div>
  </header>`;
}

export function updateHud(root: HTMLElement, state: GameState): void {
  const player = root.querySelector<HTMLElement>('[data-player]');
  const score = root.querySelector<HTMLElement>('[data-score]');
  if (player) player.textContent = state.player?.name ?? '';
  if (score) score.textContent = String(state.totalScore);
}
