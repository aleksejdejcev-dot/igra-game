import { writeFileSync } from 'node:fs';
type Entry={answer:string;paintingId:string;revealed?:boolean;row:number;col:number;direction:'across'|'down'};
const sets={
 names:{id:'crossword-names',rows:[['ГРОЗНЫЙ','p03',true],['КОЛЫЧЁВ','p06'],['СКУРАТОВ','p40'],['САЛОС','p08'],['МОРОЗОВ','p21'],['ФИЛИПП','p28']]},
 authors:{id:'crossword-authors',rows:[['ПУКИРЕВ','p34',true],['НЕВРЕВ','p24'],['НОВОСКОЛЬЦЕВ','p30'],['РЯБУШКИН','p39'],['МЯСОЕДОВ','p23'],['МАКОВСКИЙ','p18'],['ЛЕБЕДЕВ','p10'],['НЕСТЕРОВ','p29']]},
};
for(const[name,set]of Object.entries(sets)){
 const grid=new Map<string,string>(),entries:Entry[]=[];
 set.rows.forEach(([answer,paintingId,revealed],index)=>{
  const word=String(answer),direction:Entry['direction']=index===0?'across':index%2?'down':'across';let placement:{row:number;col:number}|undefined;
  if(index===0)placement={row:0,col:0};
  else outer:for(const prior of entries){const priorWord=String(set.rows[entries.indexOf(prior)][0]);for(let a=0;a<priorWord.length;a++)for(let b=0;b<word.length;b++)if(priorWord[a]===word[b]){
   const row=prior.row+(prior.direction==='down'?a:0)-(direction==='down'?b:0),col=prior.col+(prior.direction==='across'?a:0)-(direction==='across'?b:0);let valid=true;
   for(let k=0;k<word.length;k++){const r=row+(direction==='down'?k:0),c=col+(direction==='across'?k:0),value=grid.get(`${r},${c}`);if(value&&value!==word[k]){valid=false;break;}}
   if(valid){placement={row,col};break outer;}
  }}
  placement??={row:index*2,col:0};const entry:Entry={answer:word,paintingId:String(paintingId),row:placement.row,col:placement.col,direction};if(revealed)entry.revealed=true;entries.push(entry);
  for(let k=0;k<word.length;k++)grid.set(`${entry.row+(direction==='down'?k:0)},${entry.col+(direction==='across'?k:0)}`,word[k]);
 });
 const rows=[...grid.keys()].map(key=>Number(key.split(',')[0])),cols=[...grid.keys()].map(key=>Number(key.split(',')[1])),minRow=Math.min(...rows),minCol=Math.min(...cols),height=Math.max(...rows)-minRow+1,width=Math.max(...cols)-minCol+1;
 const normalized=entries.map(entry=>({...entry,row:entry.row-minRow,col:entry.col-minCol}));const cells=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>grid.get(`${r+minRow},${c+minCol}`)??null));
 writeFileSync(`src/data/crossword-${name}.json`,`${JSON.stringify({taskId:set.id,width,height,entries:normalized,grid:cells},null,2)}\n`);
}
