import paintings from '../data/paintings.json';
import zones from '../data/zones.json';
import type { TaskModule } from '../engine/tasks';
import { mountFrame } from './shared';

type Point = { x: number; y: number };
type Zone = { paintingId: string; points: [number, number][] };
type SavedPlacement = { id: string; x: number; y: number };

function centerOf(points: Point[]): Point {
  return points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 });
}

export function createDragIcons(): TaskModule {
  return {
    mount(el, cfg, api) {
      const type = cfg.type as string;
      const zone = (type === 'drag-crown' ? zones.zones.crown : zones.zones.figure) as Zone;
      mountFrame(el, cfg, api, ({ frame }) => {
        const root = document.createElement('div');
        root.className = 'icon-task';
        const intro = document.createElement('p');
        intro.className = 'icon-task-intro';
        intro.textContent = type === 'drag-crown'
          ? 'Корона должна лечь на царский венец в сцене у трона.'
          : 'На подлиннике внизу справа оставлено место для фигурки; копия такого места не имеет.';
        root.append(intro);
        if (type === 'drag-crown') {
          const poem = document.createElement('blockquote');
          poem.textContent = String(cfg.poem ?? '');
          root.append(poem);
        }

        const ids = type === 'drag-crown'
          ? [String(cfg.paintingId ?? zone.paintingId)]
          : Array.isArray(cfg.paintingIds) ? cfg.paintingIds as string[] : [zone.paintingId];
        const board = document.createElement('div');
        board.className = 'icon-paintings';
        const saved = api.loadDraft<{ placed?: SavedPlacement } | null>(null);
        const savedPlacement = saved?.placed
          && saved.placed.id === zone.paintingId
          && Number.isFinite(saved.placed.x) && Number.isFinite(saved.placed.y)
          && saved.placed.x >= 0 && saved.placed.x <= 1 && saved.placed.y >= 0 && saved.placed.y <= 1
          && pointInPolygon(saved.placed, zone.points.map(([x, y]) => ({ x, y })))
          ? saved.placed : undefined;
        let placed = Boolean(savedPlacement);
        const token = document.createElement('button');
        token.type = 'button';
        token.className = 'drag-token';
        token.textContent = type === 'drag-crown' ? '♛' : '♟';
        token.setAttribute('aria-label', type === 'drag-crown' ? 'Корона' : 'Фигурка');
        token.setAttribute('aria-pressed', 'false');
        token.draggable = true;
        token.disabled = placed;
        const status = document.createElement('p');
        status.className = 'icon-task-status';
        status.setAttribute('aria-live', 'polite');
        status.textContent = placed ? 'Предмет уже занял своё место.' : 'У предмета и картины одно назначение.';
        root.append(token, status, board);
        const payload = token.textContent ?? '';

        const place = (card: HTMLButtonElement, x: number, y: number): void => {
          if (placed) return;
          const points = zone.points.map(([px, py]) => ({ x: px, y: py }));
          const correct = card.dataset.paintingId === zone.paintingId && pointInPolygon({ x, y }, points);
          if (!correct) {
            api.attempt(false);
            status.textContent = 'Предмет не совпал с местом на полотне.';
            token.classList.add('is-wrong');
            window.setTimeout(() => token.classList.remove('is-wrong'), 400);
            return;
          }
          placed = true;
          const placement = { id: zone.paintingId, x, y };
          api.saveDraft({ ...api.loadDraft<Record<string, unknown>>({}), placed: placement });
          addBadge(card, payload, placement.x, placement.y);
          token.disabled = true;
          token.dataset.armed = '';
          token.setAttribute('aria-pressed', 'false');
          status.textContent = 'Предмет занял место на картине; замок щёлкнул.';
          frame.attempt(true);
        };

        token.addEventListener('dragstart', event => event.dataTransfer?.setData('text/plain', payload));
        token.addEventListener('click', () => {
          const armed = token.dataset.armed !== '1';
          token.dataset.armed = armed ? '1' : '';
          token.setAttribute('aria-pressed', String(armed));
          token.classList.toggle('is-armed', armed);
          status.textContent = armed ? 'Предмет отмечен; место на полотне ждёт его.' : 'Предмет снова лежит отдельно.';
        });

        for (const id of ids) {
          const painting = paintings.find(item => item.id === id);
          if (!painting) continue;
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'icon-drop';
          card.dataset.paintingId = id;
          card.setAttribute('aria-label', `${painting.caption}${id === zone.paintingId ? ', полотно с подходящим местом' : ', полотно-копия'}`);
          const img = document.createElement('img');
          img.src = `${import.meta.env.BASE_URL}assets/paintings/${painting.large ?? painting.src}`;
          img.alt = painting.caption;
          card.append(img);
          if (savedPlacement?.id === id) addBadge(card, payload, savedPlacement.x, savedPlacement.y);
          card.addEventListener('dragover', event => event.preventDefault());
          card.addEventListener('drop', event => {
            event.preventDefault();
            if (event.dataTransfer?.getData('text/plain') !== payload) return;
            const rect = img.getBoundingClientRect();
            place(card, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
          });
          card.addEventListener('click', event => {
            if (token.dataset.armed !== '1') return;
            const rect = img.getBoundingClientRect();
            place(card, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
          });
          card.addEventListener('keydown', event => {
            if ((event.key !== 'Enter' && event.key !== ' ') || token.dataset.armed !== '1') return;
            event.preventDefault();
            const point = centerOf(zone.points.map(([x, y]) => ({ x, y })));
            place(card, point.x, point.y);
          });
          board.append(card);
        }
        frame.body.append(root);
      });
    },
    destroy() {},
  };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function addBadge(card: HTMLElement, symbol: string, x: number, y: number): void {
  const badge = document.createElement('span');
  badge.className = 'placed-icon';
  badge.textContent = symbol;
  badge.style.left = `${Math.max(0, Math.min(100, x * 100))}%`;
  badge.style.top = `${Math.max(0, Math.min(100, y * 100))}%`;
  card.append(badge);
}
