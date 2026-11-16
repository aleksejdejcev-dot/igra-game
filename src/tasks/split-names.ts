import paintings from '../data/paintings.json';
import links from '../data/links.json';
import type { TaskModule } from '../engine/tasks';
import { mountFrame, normalizeWord } from './shared';

type Area = { paintingId: string; answer: string; given?: boolean };
type Link = { paintingId?: string; bookId: string | null; chapterId: string | null; paragraphId: string | null };

export function createSplitNames(): TaskModule {
  return {
    mount(el, cfg, api) {
      const areas = (cfg.areas as Area[] | undefined) ?? [];
      mountFrame(el, cfg, api, ({ frame }) => {
        const intro = document.createElement('p');
        intro.className = 'split-name-intro';
        intro.textContent = 'Имя писателя связано с источником сцены. Разворот под полотном ведёт к нужной странице; одно имя уже оставлено редакцией.';
        const grid = document.createElement('div');
        grid.className = 'split-name-grid';
        let solved = 0;

        areas.forEach((area, index) => {
          const painting = paintings.find(item => item.id === area.paintingId);
          if (!painting) return;
          const card = document.createElement('article');
          card.className = 'split-name-card';
          const image = document.createElement('img');
          image.src = `${import.meta.env.BASE_URL}assets/paintings/${painting.medium ?? painting.thumbnail}`;
          image.alt = painting.caption;
          const caption = document.createElement('p');
          caption.className = 'split-name-caption';
          caption.textContent = painting.caption;
          const title = document.createElement('h3');
          title.textContent = area.given ? area.answer : '★'.repeat(area.answer.length);
          const source = (links as Link[]).find(item => item.paintingId === area.paintingId);
          const book = document.createElement('button');
          book.type = 'button';
          book.className = 'secondary-button split-name-source';
          book.textContent = source?.paragraphId ? '▤ Книга-источник' : '▤ Открытка без текста';
          book.disabled = !source?.paragraphId;
          book.setAttribute('aria-label', source?.paragraphId ? `Разворот к картине «${painting.title}»` : `У картины «${painting.title}» нет записи в книге`);
          book.addEventListener('click', () => window.dispatchEvent(new CustomEvent('gallery:spread', { detail: { paintingId: painting.id } })));
          const input = document.createElement('input');
          input.maxLength = area.answer.length;
          input.autocomplete = 'off';
          input.setAttribute('aria-label', `Имя писателя для картины ${index + 1}, ${area.answer.length} букв`);
          input.placeholder = 'Фамилия писателя';
          if (area.given) {
            input.value = area.answer;
            input.disabled = true;
            solved++;
          }
          const verify = (countWrong = true): void => {
            if (input.disabled || !input.value.trim()) return;
            const ok = normalizeWord(input.value) === normalizeWord(area.answer);
            if (ok) {
              input.value = area.answer;
              input.disabled = true;
              input.classList.add('is-correct');
              title.textContent = area.answer;
              title.classList.add('is-revealed');
              solved++;
              if (solved === areas.length) frame.attempt(true);
            } else {
              if (countWrong) api.attempt(false);
              input.classList.add('is-wrong');
              window.setTimeout(() => input.classList.remove('is-wrong'), 450);
            }
          };
          input.addEventListener('change', () => verify());
          input.addEventListener('task:restore', () => verify(false));
          input.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); verify(); }
          });
          card.append(image, caption, title, book, input);
          grid.append(card);
        });
        frame.body.append(intro, grid);
      });
    },
    destroy() {},
  };
}
