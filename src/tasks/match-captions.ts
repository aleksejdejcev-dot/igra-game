import paintingsData from '../data/paintings.json';
import type { Painting } from '../ui/types';
import type { TaskModule } from '../engine/tasks';
import { mountFrame } from './shared';
export function createMatchCaptions():TaskModule{return{mount(el,cfg,api){
  const hallId=String(cfg.hallId??'h02');const paintings=(paintingsData as Painting[]).filter(p=>p.hallId===hallId).slice(0,4);
  const labels=[...paintings].sort(()=>Math.random()-.5);const assigned=new Map<number,number>();let selected=-1,selectedLabel=-1,wrongPair:{label:number;picture:number}|null=null,revealWrongPair:(()=>void)|null=null;
  const taskApi={...api,useHint:async(n:number)=>{const text=await api.useHint(n);if(n===1)revealWrongPair?.();return text;}};
  const task=mountFrame(el,cfg,taskApi,({frame})=>{
    const board=document.createElement('div');board.className='match-board';
    const pictures=document.createElement('div');pictures.className='match-pictures';const captions=document.createElement('div');captions.className='match-captions';
    const message=document.createElement('p');message.className='task-status';message.textContent='Каталожные листки ждут своего места';frame.body.append(message,board);board.append(pictures,captions);
    const render=()=>{pictures.replaceChildren();captions.replaceChildren();paintings.forEach((painting,index)=>{
      const button=document.createElement('button');button.type='button';button.className='match-picture';button.dataset.paintingId=painting.id;button.setAttribute('aria-label',`Картина ${index+1}: ${painting.title}`);button.setAttribute('aria-pressed',String(selected===index));if([...assigned.values()].includes(index))button.classList.add('is-matched');
      if(wrongPair?.picture===index)button.classList.add('is-hint');
      const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL}assets/paintings/${painting.thumbnail}`;img.alt=painting.caption;button.append(img);
      button.addEventListener('click',()=>{if(selectedLabel>=0){assign(selectedLabel,index);selectedLabel=-1;}else{selected=index;render();}});button.addEventListener('dragstart',event=>event.dataTransfer?.setData('text/plain',String(index)));button.draggable=true;pictures.append(button);
    });labels.forEach((painting,labelIndex)=>{
      const button=document.createElement('button');button.type='button';button.className='match-caption';button.textContent=`${painting.artist}. ${painting.title}. ${painting.year}`;if(assigned.has(labelIndex))button.classList.add('is-matched');
      button.dataset.paintingId=painting.id;button.setAttribute('aria-pressed',String(selectedLabel===labelIndex));
      if(wrongPair?.label===labelIndex)button.classList.add('is-hint');
      button.addEventListener('click',()=>{if(selected>=0){assign(labelIndex,selected);selected=-1;}else{selectedLabel=labelIndex;render();}});
      button.addEventListener('dragover',event=>event.preventDefault());button.addEventListener('drop',event=>{event.preventDefault();assign(labelIndex,Number(event.dataTransfer?.getData('text/plain')));});captions.append(button);
    });};render();
    const assign=(labelIndex:number,pictureIndex:number)=>{if(!Number.isInteger(labelIndex)||labelIndex<0||labelIndex>=labels.length||!Number.isInteger(pictureIndex)||pictureIndex<0||pictureIndex>=paintings.length)return;if(assigned.has(labelIndex)||[...assigned.values()].includes(pictureIndex))return;const ok=paintings[pictureIndex].id===labels[labelIndex].id;selected=-1;selectedLabel=-1;if(!ok){api.attempt(false);wrongPair={label:labelIndex,picture:pictureIndex};revealWrongPair=()=>renderHint(labelIndex,pictureIndex);render();const wrongLabel=captions.children[labelIndex] as HTMLElement|undefined,wrongPicture=pictures.children[pictureIndex] as HTMLElement|undefined;wrongLabel?.classList.add('is-wrong');wrongPicture?.classList.add('is-wrong');window.setTimeout(()=>{wrongLabel?.classList.remove('is-wrong');wrongPicture?.classList.remove('is-wrong');},500);return;}assigned.set(labelIndex,pictureIndex);wrongPair=null;revealWrongPair=null;render();if(assigned.size===paintings.length){message.textContent='Каталог сошёлся с развеской';task.frame.attempt(true);}};
    function renderHint(labelIndex:number,pictureIndex:number):void{render();const picture=pictures.querySelector<HTMLElement>(`[data-painting-id="${paintings[pictureIndex].id}"]`);const caption=captions.querySelector<HTMLElement>(`[data-painting-id="${labels[labelIndex].id}"]`);picture?.classList.add('is-hint');caption?.classList.add('is-hint');window.setTimeout(()=>{picture?.classList.remove('is-hint');caption?.classList.remove('is-hint');},1800);}
  });void task;
},destroy(){}};}
