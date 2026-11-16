import paintingsData from '../data/paintings.json';
import type { Painting } from '../ui/types';
import type { TaskModule } from '../engine/tasks';
import { mountFrame } from './shared';
export function createPuzzle(): TaskModule {
  return { mount(el,cfg,api) {
    const painting=(paintingsData as Painting[]).find(p=>p.id===String(cfg.paintingId??'p36'));
    if(!painting)return;
    const restored=api.loadDraft<{order?:number[]}>({});
    const order=restored.order?.length===12&&new Set(restored.order).size===12&&restored.order.every(value=>Number.isInteger(value)&&value>=0&&value<12)?[...restored.order]:Array.from({length:12},(_,i)=>i).sort(()=>Math.random()-.5);let selected=-1;
    const taskState:{finish:()=>void}={finish:()=>undefined};
    mountFrame(el,cfg,api,({frame})=>{
      taskState.finish=()=>frame.attempt(true);
      const grid=document.createElement('div');grid.className='puzzle-grid';grid.setAttribute('aria-label','Мозаика из двенадцати частей');
      const status=document.createElement('p');status.className='task-status';status.textContent='Фрагменты ждут своего места';
      const image=`${import.meta.env.BASE_URL}assets/paintings/${painting.large??painting.src}`;frame.body.append(status,grid);
      const draw=()=>{grid.replaceChildren();order.forEach((correct,index)=>{
        const tile=document.createElement('button');tile.type='button';tile.className='puzzle-tile';tile.setAttribute('aria-label','Фрагмент мозаики');tile.dataset.tile=String(correct);tile.dataset.slot=String(index);
        tile.style.backgroundImage=`url("${image}")`;tile.style.backgroundPosition=`${(correct%4)*100/3}% ${Math.floor(correct/4)*100/2}%`;
        if(selected===index)tile.classList.add('is-selected');
        tile.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();selected=index;tile.setPointerCapture(event.pointerId);tile.classList.add('is-selected');});
        tile.addEventListener('pointerup',event=>{const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('.puzzle-tile');const destination=Number(target?.dataset.slot);if(Number.isInteger(destination)&&destination!==index)swap(index,destination);else{selected=-1;draw();}});
        tile.addEventListener('click',event=>{if(event.detail!==0)return;if(selected<0){selected=index;draw();return;}if(selected===index){selected=-1;draw();return;}swap(selected,index);});
        grid.append(tile);
      });};
      const swap=(a:number,b:number)=>{[order[a],order[b]]=[order[b],order[a]];selected=-1;api.saveDraft({...api.loadDraft<Record<string,unknown>>({}),order:[...order]});draw();
        if(order[a]===a||order[b]===b)playClick();
        if(order.every((value,i)=>value===i)){status.textContent='Мозаика сложилась в картину';taskState.finish();}
        else {api.attempt(false);status.textContent='Два фрагмента поменялись местами';}
      };
      draw();
    });
  },destroy(){} };
}
function playClick():void {try{const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=660;gain.gain.setValueAtTime(.04,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);osc.connect(gain).connect(context.destination);osc.start();osc.stop(context.currentTime+.12);osc.onended=()=>void context.close();}catch{/* Text feedback remains available when audio is unavailable. */}}
