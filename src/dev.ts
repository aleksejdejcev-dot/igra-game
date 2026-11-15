import tasksData from './data/tasks.json';
import type { TaskConfig } from './ui/types';
import { getTask, registerCoreTasks } from './tasks/registry';
import { registerTaskStubs } from './ui/task-stub';
import type { ReaderChapter } from './ui/reader';
import './style.css';
const root=document.querySelector<HTMLElement>('#dev-app')!;
if(new URLSearchParams(location.search).get('dev')!=='1'){root.textContent='Пробная полоса открыта только в редакционном режиме.';}
else{
 const tasks=tasksData as TaskConfig[];registerCoreTasks();registerTaskStubs([...new Set(tasks.map(task=>task.type))]);
 const loaders=import.meta.glob(['./data/texts/*.json','!**/texts-index.json']) as Record<string,()=>Promise<{default:ReaderChapter}>>;
 const load=async(ids:unknown):Promise<ReaderChapter['paragraphs']>=>{if(!Array.isArray(ids))return[];const selected=ids as string[],chapters=[...new Set(selected.map(id=>id.replace(/^t-/u,'').replace(/-\d{4}$/u,'')))],result:ReaderChapter['paragraphs']=[];for(const id of chapters){const mod=await loaders[`./data/texts/${id}.json`]?.();for(const paragraph of mod?.default.paragraphs??[])if(selected.includes(paragraph.id))result.push(paragraph);}return result;};
 const params=new URLSearchParams(location.search),current=params.get('task')??'memo';
 const wrapper=document.createElement('div');wrapper.className='dev-task-page';
 const header=document.createElement('header');header.className='dev-task-header';const h=document.createElement('h1');h.textContent='Пробная редакционная полоса';const select=document.createElement('select');select.setAttribute('aria-label','Задание');tasks.forEach(task=>{const option=document.createElement('option');option.value=task.id;option.textContent=task.id;option.selected=task.id===current;select.append(option);});select.addEventListener('change',()=>{location.search=`?dev=1&task=${encodeURIComponent(select.value)}`;});header.append(h,select);wrapper.append(header);root.append(wrapper);
 const cfg=tasks.find(task=>task.id===current)??tasks[0];const devCfg={...cfg};if(params.has('maxMoves'))devCfg.maxMoves=Number(params.get('maxMoves'));const dialog=document.createElement('dialog');dialog.className='content-dialog task-dialog dev-task-dialog';const content=document.createElement('div');content.className='dialog-body task-content';dialog.append(content);root.append(dialog);
 void (async()=>{const enriched={...devCfg,hintsUsed:0} as TaskConfig&{paragraphs?:ReaderChapter['paragraphs'];sourceParagraphs?:ReaderChapter['paragraphs']};enriched.paragraphs=await load(cfg.paragraphIds);enriched.sourceParagraphs=await load(cfg.sourceParagraphIds);const api={attempt:()=>undefined,solve:()=>undefined,useHint:async(n:number)=>`Записка ${n}: строка из редакционной папки.`};const factory=getTask(cfg.type);if(factory)(await factory()).mount(content,enriched,api);dialog.showModal();})();
}
