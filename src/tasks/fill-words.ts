import type { TaskModule } from '../engine/tasks';
import { mountFrame, normalizeWord } from './shared';
type Paragraph={id:string;text:string};type Blank={index:number;answer:string};
export function createFillWords():TaskModule{return{mount(el,cfg,api){
  const paragraphs=Array.isArray(cfg.paragraphs)?cfg.paragraphs as Paragraph[]:[];
  const blanks=Array.isArray(cfg.blanks)?cfg.blanks as Blank[]:[];
  const taskState:{attempt:(ok:boolean)=>void}={attempt:()=>undefined};
  mountFrame(el,cfg,api,({frame})=>{
    taskState.attempt=frame.attempt.bind(frame);
    if(cfg.type==='fill-words-monument'){
      const image=document.createElement('img');image.className='monument-image';image.alt='Памятник «Тысячелетие России»';image.src=`${import.meta.env.BASE_URL}${String(cfg.image??'assets/tasks/s10_1.webp').replace(/^\//u,'')}`;frame.body.append(image);
      const sources=Array.isArray(cfg.sourceParagraphs)?cfg.sourceParagraphs as Paragraph[]:[];
      const source=document.createElement('details');source.className='monument-source';const summary=document.createElement('summary');summary.textContent='Листок из исторического тома';source.append(summary);
      sources.forEach(item=>{const p=document.createElement('p');p.textContent=item.text;source.append(p);});frame.body.append(source);
      const fields=document.createElement('div');fields.className='fill-fields';
      const names=Array.isArray(cfg.names)?cfg.names as string[]:['Сильвестр','Анастасия','Адашев'];
      names.forEach((name,index)=>addField(fields,name,index,taskState,api));frame.body.append(fields);
      return;
    }
    const title=document.createElement('p');title.className='task-status';title.textContent='Князь Михайло Репнин';frame.body.append(title);
    const text=document.createElement('div');text.className='poem-text';const words=new Map(blanks.map(blank=>[blank.index,blank.answer]));
    paragraphs.forEach((paragraph,index)=>{
      const line=document.createElement('p');line.dataset.paragraphId=paragraph.id;
      const answer=words.get(index);
      if(answer){const re=new RegExp(`(${answer})`,'iu');const parts=paragraph.text.split(re);parts.forEach(part=>{if(normalizeWord(part)===normalizeWord(answer)){addInlineField(line,answer,index,taskState,api);}else line.append(document.createTextNode(part));});}
      else line.textContent=paragraph.text;
      text.append(line);
    });frame.body.append(text);
  });
},destroy(){}};}
function addInlineField(parent:HTMLElement,answer:string,index:number,task:{attempt:(ok:boolean)=>void},api:{attempt:(ok:boolean)=>void}):void{
  const input=document.createElement('input');input.className='fill-word';input.maxLength=answer.length;input.size=answer.length;input.autocomplete='off';input.setAttribute('aria-label',`Пропуск ${index+1}, ${answer.length} букв`);
  const verify=()=>{if(input.disabled)return;const ok=normalizeWord(input.value)===normalizeWord(answer);if(!ok)api.attempt(false);if(ok){input.value=answer;input.disabled=true;input.classList.add('is-correct');}else{input.classList.add('is-wrong');window.setTimeout(()=>input.classList.remove('is-wrong'),350);}if([...parent.closest('.task-content')!.querySelectorAll<HTMLInputElement>('.fill-word')].every(field=>field.disabled))task.attempt(true);};input.addEventListener('change',verify);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();verify();}});parent.append(input);
}
function addField(parent:HTMLElement,answer:string,index:number,task:{attempt:(ok:boolean)=>void},api:{attempt:(ok:boolean)=>void}):void{
  const label=document.createElement('label');label.className='fill-name-field';label.textContent=`Фигура ${index+1}`;
  const input=document.createElement('input');input.maxLength=answer.length;input.style.setProperty('--letter-count',String(answer.length));input.setAttribute('aria-label',`Имя фигуры ${index+1}, ${answer.length} букв`);input.placeholder='—';
  const verify=()=>{if(input.disabled)return;const ok=normalizeWord(input.value)===normalizeWord(answer);if(!ok)api.attempt(false);if(ok){input.value=answer;input.disabled=true;input.classList.add('is-correct');}else{input.classList.add('is-wrong');window.setTimeout(()=>input.classList.remove('is-wrong'),350);}if([...parent.querySelectorAll<HTMLInputElement>('input')].every(field=>field.disabled))task.attempt(true);};
  input.addEventListener('change',verify);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();verify();}});label.append(input);parent.append(label);
}
