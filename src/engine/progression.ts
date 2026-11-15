import type { Hall } from '../ui/types';
import type { SolvedTaskState } from './state';

export type SolvedTasks = Record<string, Pick<SolvedTaskState,'points'>>;

export function solvedHallIds(halls:Hall[],solvedTasks:SolvedTasks):Set<string>{
 return new Set(halls.filter(hall=>hall.id!=='h11'&&hall.taskIds.length>0&&hall.taskIds.every(id=>(solvedTasks[id]?.points??0)>0)).map(hall=>hall.id));
}

export function hallsEligibleToUnlock(halls:Hall[],solvedTasks:SolvedTasks):string[]{
 const solved=solvedHallIds(halls,solvedTasks);
 return halls.filter(hall=>{
  if(hall.id==='h01')return true;
  if(hall.unlockAfterCount!==undefined)return solved.size>=hall.unlockAfterCount;
  if(hall.id==='h11')return solved.size>=8;
  const prerequisites=hall.unlockAfter??[];
  return prerequisites.length>0&&prerequisites.every(id=>solved.has(id));
 }).map(hall=>hall.id);
}

export function hallCompletionCount(halls:Hall[],solvedTasks:SolvedTasks):number{return solvedHallIds(halls,solvedTasks).size;}
