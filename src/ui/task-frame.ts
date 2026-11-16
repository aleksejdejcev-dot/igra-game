import type { TaskApi } from '../engine/tasks';
import { hintCostPercent } from '../engine/scoring';
import type { TaskConfig } from './types';

const titles: Record<string, string> = {
  memo: 'Карточная забава при редакционном столе',
  puzzle: 'Картина, рассыпавшаяся на части',
  'match-captions': 'Каталог выставки',
  'fill-words-repnin': 'Стихи князя Репнина',
  'fill-words-monument': 'Фигуры памятника',
  'crossword-names': 'Имена в исторических заметках',
  'crossword-authors': 'Имена мастеров выставки',
  'split-names': 'Три области и три имени',
  'drag-crown': 'Корона в старинной галерее',
  'drag-figure': 'Подлинник и повторение',
  'combo-lock': 'Три окна памяти о Салосе',
  chess: 'Партия за царским столом',
  gramophone: 'Музыка в редакционной комнате',
  'connect-pairs': 'Музыканты и литераторы',
};

export class TaskFrame {
  readonly body: HTMLElement;
  private hintButton: HTMLButtonElement;
  private hintNote: HTMLElement;
  private hintLevel = 0;
  private finished = false;

  constructor(root: HTMLElement, private cfg: TaskConfig, private api: TaskApi, private close: () => void) {
    this.hintLevel = Math.min(3, Number(cfg.hintsUsed) || 0);
    root.replaceChildren();
    const head = document.createElement('header'); head.className = 'dialog-head task-frame-head';
    const title = document.createElement('h2'); title.textContent = titles[cfg.type] ?? 'Дело редакции';
    const cross = document.createElement('button'); cross.type = 'button'; cross.className = 'icon-button'; cross.textContent = '×'; cross.setAttribute('aria-label', 'Закрыть');
    cross.addEventListener('click', close); head.append(title, cross);
    const lampRow = document.createElement('div'); lampRow.className = 'task-lamp-row';
    this.hintButton = document.createElement('button'); this.hintButton.type = 'button'; this.hintButton.className = 'task-hint-lamp'; this.hintButton.textContent = '♧ Записка при лампе';
    this.hintButton.setAttribute('aria-label', 'Записка-подсказка');
    this.hintNote = document.createElement('p'); this.hintNote.className = 'task-hint-note'; this.hintNote.setAttribute('aria-live', 'polite');
    this.hintButton.addEventListener('click', () => void this.revealHint()); lampRow.append(this.hintButton);
    if (this.hintLevel >= 3) { this.hintButton.textContent = '♧ Записки прочитаны'; this.hintButton.disabled = true; }
    this.body = document.createElement('section'); this.body.className = 'task-content'; this.body.setAttribute('aria-live', 'polite');
    root.append(head, lampRow, this.hintNote, this.body);
  }

  private async revealHint(): Promise<void> {
    if (this.hintLevel >= 3 || this.finished) return;
    const next = this.hintLevel + 1;
    if (this.hintNote.dataset.confirm !== String(next)) {
      this.hintNote.dataset.confirm = String(next);
      this.hintNote.textContent = `Записка раскроется через миг; награда уменьшится на ${hintCostPercent(next, this.cfg.type)}%.`;
      this.hintButton.textContent = `Записка · −${hintCostPercent(next, this.cfg.type)}%`;
      await new Promise(resolve => window.setTimeout(resolve, 650));
      if (this.finished || this.hintNote.dataset.confirm !== String(next)) return;
    }
    const text = await this.api.useHint(next);
    if (!text) return;
    this.hintLevel = next; this.hintNote.dataset.confirm = '';
    this.hintNote.textContent = text;
    this.hintButton.textContent = this.hintLevel < 3 ? '♧ Следующая записка' : '♧ Записки прочитаны';
    this.hintButton.disabled = this.hintLevel >= 3;
  }

  attempt(ok: boolean): void {
    if (this.finished) return;
    this.api.attempt(ok);
    if (!ok) return;
    this.finished = true;
    this.api.solve();
    this.body.classList.add('task-solved');
    const seal = document.createElement('p'); seal.className = 'task-result-seal'; seal.textContent = 'Печать редакции поставлена';
    this.body.append(seal);
    window.setTimeout(this.close, 1100);
  }
}
