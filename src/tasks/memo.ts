import paintingsData from '../data/paintings.json';
import type { Painting } from '../ui/types';
import type { TaskModule } from '../engine/tasks';
import { mountFrame } from './shared';

type Card = { id: string; painting: Painting; pair: number };
export function createMemo(): TaskModule {
  let timers: number[] = [];
  return {
    mount(el, cfg, api) {
      timers=[];
      const paintings=paintingsData as Painting[];
      const ids=Array.isArray(cfg.paintingIds)?cfg.paintingIds as string[]:['p02','p05','p16','p26','p46','p47'];
      const items=ids.map(id=>paintings.find(p=>p.id===id)).filter((p):p is Painting=>Boolean(p)).slice(0,6);
      let deck:Card[]=items.flatMap((painting,pair)=>[
        {id:`${painting.id}-a`,painting,pair},
        {id:`${painting.id}-b`,painting,pair},
      ]);
      const saved = api.loadDraft<{ order?: string[]; matched?: number[]; moves?: number }>({});
      if(saved.order?.length===deck.length){const byId=new Map(deck.map(card=>[card.id,card]));const restored=saved.order.map(id=>byId.get(id)).filter((card):card is Card=>Boolean(card));if(restored.length===deck.length)deck=restored;}
      const faceUp=new Set<number>(),matched=new Set<number>((saved.matched??[]).filter(index=>Number.isInteger(index)&&index>=0&&index<deck.length));
      let first=-1,locked=false,moves=Math.max(0,Number(saved.moves)||0),pairs=new Set([...matched].map(index=>deck[index].pair)).size;
      const limit=Number(cfg.maxMoves)||30;
      const task=mountFrame(el,cfg,api,({frame})=>{
        frame.body.classList.add('memo-task');
        const status=document.createElement('p');status.className='task-status';
        const board=document.createElement('div');board.className='memo-board';board.setAttribute('aria-label','Двенадцать карточек выставки');
        frame.body.append(status,board);
        const save=()=>api.saveDraft({...api.loadDraft<Record<string,unknown>>({}),order:deck.map(card=>card.id),matched:[...matched],moves});
        const shuffle=()=>{deck=deck.sort(()=>Math.random()-.5);};
        const render=()=>{
          status.textContent=`Ходы: ${moves} из ${limit}`;board.replaceChildren();
          deck.forEach((card,index)=>{
            const button=document.createElement('button');button.type='button';button.className='memo-card';button.setAttribute('aria-label',card.painting.caption);
            button.dataset.pair=String(card.pair);
            if(faceUp.has(index))button.classList.add('is-open');if(matched.has(index))button.classList.add('is-matched');
            const inner=document.createElement('span');inner.className='memo-card-inner';
            const back=document.createElement('span');back.className='memo-face memo-front';back.textContent='З.В. · 1898';
            const face=document.createElement('span');face.className='memo-face memo-image';
            const image=document.createElement('img');image.alt=card.painting.caption;
            image.src=`${import.meta.env.BASE_URL}assets/paintings/${card.painting.medium??card.painting.src}`;
            image.style.objectFit=cfg.fit==='crop'&&cfg.focus&&typeof cfg.focus==='object'?'cover':'contain';
            if(image.style.objectFit==='cover'){
              const focus=(cfg.focus as Record<string,{x:number;y:number}>)[card.painting.id];
              if(focus)image.style.objectPosition=`${focus.x*100}% ${focus.y*100}%`;
              else image.style.objectFit='contain';
            }
            face.append(image);inner.append(back,face);button.append(inner);
            button.addEventListener('click',()=>{
              if(locked||matched.has(index)||faceUp.has(index))return;
              faceUp.add(index);button.classList.add('is-open');
              save();
              if(first<0){first=index;return;}
              const prior=first;first=-1;moves+=1;status.textContent=`Ходы: ${moves} из ${limit}`;
              if(moves>limit){api.attempt(false);locked=true;const timer=window.setTimeout(()=>{deck=deck.sort(()=>Math.random()-.5);faceUp.clear();matched.clear();pairs=0;moves=0;locked=false;render();},680);timers.push(timer);return;}
              if(deck[prior].pair===card.pair){matched.add(prior);matched.add(index);button.classList.add('is-matched');board.children[prior]?.classList.add('is-matched');pairs+=1;save();
                if(pairs===items.length)task.frame.attempt(true);return;}
              api.attempt(false);locked=true;save();
              const timer=window.setTimeout(()=>{faceUp.delete(prior);faceUp.delete(index);board.children[prior]?.classList.remove('is-open');button.classList.remove('is-open');locked=false;
                if(moves>limit){deck=deck.sort(()=>Math.random()-.5);faceUp.clear();matched.clear();pairs=0;moves=0;render();}
              },680);timers.push(timer);
            });board.append(button);
          });status.textContent=`Ходы: ${moves} из ${limit}`;
        };
        shuffle();render();
      });
      void task;
    },
    destroy(){timers.forEach(window.clearTimeout);timers=[];},
  };
}
