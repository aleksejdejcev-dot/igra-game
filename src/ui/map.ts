import type { GameState } from '../engine/state';
import type { Hall } from './types';

export function mapMarkup(halls: Hall[], state: GameState): string {
  const coords: Record<string, [number, number]> = { h01:[90,100],h02:[290,100],h03:[490,100],h04:[690,100],h05:[90,240],h06:[230,240],h07:[370,240],h08:[510,240],h09:[650,240],h10:[790,240],h11:[440,390] };
  const shortTitles:Record<string,string>={h01:'Вестибюль',h02:'Царство',h03:'Филипп',h04:'Опричнина',h05:'Юродивые',h06:'Семья',h07:'Шахматы',h08:'Тысячелетие',h09:'Граммофон',h10:'Сокровищница',h11:'Редакция'};
  return `<dialog class="map-dialog"><div class="dialog-head"><h2>План галереи</h2><button class="icon-button dialog-close" aria-label="Закрыть">×</button></div>
    <svg class="gallery-map" viewBox="0 0 900 440" role="img" aria-label="План залов галереи">
      <g class="map-corridors"><path d="M90 100H690V180H90H790M90 180V240M230 180V240M370 180V240M510 180V240M650 180V240M790 180V240M440 180V390" /></g>
      ${halls.map((hall) => {
        const [x,y] = coords[hall.id] ?? [400,415];
        const open = state.unlockedHalls.includes(hall.id);
        return `<a href="#hall/${hall.id}" class="map-room ${open?'is-open':'is-locked'}" data-hall-link="${hall.id}" aria-label="${hall.title}: ${open?'открыт':'заперт'}"><rect x="${x-52}" y="${y-28}" width="104" height="56" rx="7"/><text x="${x}" y="${y+4}">${shortTitles[hall.id]??hall.title}</text><text class="map-lock" x="${x}" y="${y+20}">${open?'ОТКРЫТ':'ЗАПЕРТ'}</text></a>`;
      }).join('')}
      <circle class="map-player" data-map-player cx="100" cy="125" r="8" aria-label="Положение корреспондента" />
    </svg><p class="map-caption">Открытые двери отмечены золотом; за запертыми ещё хранятся неразгаданные тайны.</p>
  </dialog>`;
}
