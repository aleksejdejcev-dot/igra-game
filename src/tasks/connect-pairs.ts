import type { TaskModule } from '../engine/tasks';
import { mountFrame } from './shared';

type Person={id:string;name:string;image:string;group:'composer'|'writer'};
const people:Person[]=[
 {id:'rubinstein',name:'Антон Рубинштейн',image:'s17_1.webp',group:'composer'},
 {id:'mussorgsky',name:'Модест Мусоргский',image:'s17_2.webp',group:'composer'},
 {id:'tchaikovsky',name:'Пётр Чайковский',image:'s17_3.webp',group:'composer'},
 {id:'lermontov',name:'Михаил Лермонтов',image:'s17_4.webp',group:'writer'},
 {id:'pushkin',name:'Александр Пушкин',image:'s17_5.webp',group:'writer'},
 {id:'lazhechnikov',name:'Иван Лажечников',image:'s17_6.webp',group:'writer'},
];
export const CONNECT_PAIRS=[['rubinstein','lermontov'],['mussorgsky','pushkin'],['tchaikovsky','lazhechnikov']];
export function isCorrectConnection(a:string,b:string,pairs:readonly (readonly string[])[]=CONNECT_PAIRS):boolean{return pairs.some(([left,right])=>a===left&&b===right||a===right&&b===left);}
export function createConnectPairs():TaskModule{let resize:ResizeObserver|null=null;return{mount(el,cfg,api){const pairs=(Array.isArray(cfg.pairs)?cfg.pairs:CONNECT_PAIRS) as string[][];const saved=api.loadDraft<{connected?:Array<[string,string]>}>({});const connected=new Map<string,string>((saved.connected??[]).filter(([a,b])=>isCorrectConnection(a,b,pairs)));let selected:string|null=null,finished=connected.size===pairs.length;mountFrame(el,cfg,api,({frame})=>{const area=document.createElement('div');area.className='connect-pairs';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('connect-lines');svg.setAttribute('aria-hidden','true');const columns:Record<Person['group'],HTMLElement>={composer:document.createElement('div'),writer:document.createElement('div')};columns.composer.className='connect-column composer-column';columns.writer.className='connect-column writer-column';const cards=new Map<string,HTMLButtonElement>();
 const updateLines=()=>{const bounds=area.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);svg.replaceChildren();for(const [from,to] of connected){const a=cards.get(from)?.getBoundingClientRect(),b=cards.get(to)?.getBoundingClientRect();if(!a||!b)continue;const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.classList.add('connect-line');line.dataset.pair=`${from}:${to}`;line.setAttribute('x1',String(a.right-bounds.left));line.setAttribute('y1',String(a.top+a.height/2-bounds.top));line.setAttribute('x2',String(b.left-bounds.left));line.setAttribute('y2',String(b.top+b.height/2-bounds.top));line.setAttribute('stroke','#f2d178');line.setAttribute('stroke-width','6');line.setAttribute('stroke-linecap','round');svg.append(line);}};
 const pair=(id:string)=>{
  if(finished)return;
  const card=cards.get(id);
  if(!card)return;
  const alreadyConnected=connected.has(id)||[...connected.values()].includes(id);
  if(!selected){if(alreadyConnected)return;selected=id;card.classList.add('is-selected');return;}
  if(selected===id){card.classList.remove('is-selected');selected=null;return;}
  // Выбор ранее соединённого портрета не должен сбрасывать текущий выбор.
  if(alreadyConnected)return;
  const first=selected;
  const valid=isCorrectConnection(first,id,pairs);
  cards.get(first)?.classList.remove('is-selected');
  selected=null;
  if(!valid){api.attempt(false);cards.get(first)?.classList.add('is-wrong');card.classList.add('is-wrong');window.setTimeout(()=>{cards.get(first)?.classList.remove('is-wrong');card.classList.remove('is-wrong');},450);return;}
  const composer=people.find(person=>person.group==='composer'&&(person.id===first||person.id===id))!.id;
  const writer=people.find(person=>person.group==='writer'&&(person.id===first||person.id===id))!.id;
  connected.set(composer,writer);api.saveDraft({...api.loadDraft<Record<string,unknown>>({}),connected:[...connected]});
  cards.get(first)?.classList.add('is-connected');card.classList.add('is-connected');
  updateLines();
  if(connected.size===pairs.length){finished=true;area.classList.add('task-solved');frame.attempt(true);}
 };
 for(const person of people){const card=document.createElement('button');card.type='button';card.className=`connect-person ${person.group}`;card.dataset.person=person.id;card.draggable=person.group==='composer';card.setAttribute('aria-label',person.name);const img=document.createElement('img');img.src=`${import.meta.env.BASE_URL}assets/tasks/${person.image}`;img.alt=person.name;const caption=document.createElement('span');caption.textContent=person.name;card.append(img,caption);card.addEventListener('click',()=>pair(person.id));if(person.group==='composer')card.addEventListener('dragstart',event=>event.dataTransfer?.setData('text/plain',person.id));else{card.addEventListener('dragover',event=>event.preventDefault());card.addEventListener('drop',event=>{event.preventDefault();const from=event.dataTransfer?.getData('text/plain');if(from)pair(person.id);});}cards.set(person.id,card);if(connected.has(person.id)||[...connected.values()].includes(person.id))card.classList.add('is-connected');columns[person.group].append(card);}
 const coverFiles=Array.isArray(cfg.coverImages)?cfg.coverImages as string[]:['cover-rubinstein.jpg','cover-lermontov.jpg','cover-pushkin.jpg'];const coverNotes:Record<string,string>={'cover-rubinstein.jpg':'Ноты музыкальной картины «Иван Грозный»','cover-lermontov.jpg':'Издание поэмы о купце Калашникове','cover-pushkin.jpg':'Издание трагедии «Борис Годунов»'};const coverPanel=document.createElement('section');coverPanel.className='connect-book-covers';const coverHeading=document.createElement('h3');coverHeading.textContent='Издания в граммофонной комнате';coverPanel.append(coverHeading);for(const file of coverFiles){const figure=document.createElement('figure');const image=document.createElement('img');image.src=`${import.meta.env.BASE_URL}assets/tasks/${file}`;image.alt=coverNotes[file]??'Старинное книжное издание';const caption=document.createElement('figcaption');caption.textContent=coverNotes[file]??'Старинное книжное издание';figure.append(image,caption);coverPanel.append(figure);}area.append(columns.composer,svg,columns.writer);frame.body.append(area,coverPanel);resize=new ResizeObserver(updateLines);resize.observe(area);requestAnimationFrame(updateLines);});},destroy(){resize?.disconnect();resize=null;}};}
