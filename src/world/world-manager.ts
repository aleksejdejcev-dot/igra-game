import { PerspectiveCamera, Scene, type Object3D } from 'three';
import type { Hall, Painting, PaintingLink, TaskConfig } from '../ui/types';
import type { GameState } from '../engine/state';
import { dimensionsForPaintings } from './painting-layout';
import { buildHall } from './hall-builder';
import type { BuiltHall } from './types';
import type { Collider } from './collision';

export class WorldManager {
  private loaded=new Map<string,BuiltHall>();private centers:number[]=[];private widths:number[]=[];currentIndex=0;
  constructor(private scene:Scene,private camera:PerspectiveCamera,private halls:Hall[],private paintings:Painting[],private links:PaintingLink[],private tasks:TaskConfig[],private baseUrl:string,private getState:()=>GameState,private interact:(type:string,id:string)=>void,private onDoorUnlock:(hallId:string)=>void=()=>undefined){
    let x=0;halls.forEach((hall,index)=>{const width=dimensionsForPaintings(hall.paintingIds.length).width;this.widths[index]=width;this.centers[index]=x+width/2;x+=width;});
  }
  enter(hallId:string):void{const index=Math.max(0,this.halls.findIndex(hall=>hall.id===hallId));this.currentIndex=index;this.camera.position.set(this.centers[index],1.6,0);this.refresh();}
  private refresh():void{
    for(let index=0;index<this.halls.length;index+=1)if(Math.abs(index-this.currentIndex)<=1&&!this.loaded.has(this.halls[index].id)){
      const hall=this.halls[index],state=this.getState();const built=buildHall({hall,hallIndex:index,centerX:this.centers[index],halls:this.halls,paintings:this.paintings,links:this.links,tasks:this.tasks,unlockedHalls:new Set(state.unlockedHalls),baseUrl:this.baseUrl,onInteract:this.interact,onDoorUnlock:this.onDoorUnlock});
      this.loaded.set(hall.id,built);this.scene.add(built.group);
    }
    for(const [id,built] of this.loaded){const index=this.halls.findIndex(hall=>hall.id===id);if(Math.abs(index-this.currentIndex)>1){this.scene.remove(built.group);built.dispose();this.loaded.delete(id);}}
    for(const [id,built] of this.loaded){const index=this.halls.findIndex(hall=>hall.id===id);built.setActive(index===this.currentIndex);for(const door of built.doors)door.setOpen(this.getState().unlockedHalls.includes(door.hallId));built.group.traverse(object=>{const taskId=object.userData.taskId as string|undefined;const setSolved=object.userData.setSolved as ((solved:boolean)=>void)|undefined;if(taskId&&setSolved)setSolved((this.getState().solvedTasks[taskId]?.points??0)>0);});}
    this.updateVisibility();
  }
  update(dt:number):void{
    for(const built of this.loaded.values())for(const door of built.doors)door.update(dt);
    this.updateVisibility();
    const left=this.centers[this.currentIndex]-this.widths[this.currentIndex]/2,right=this.centers[this.currentIndex]+this.widths[this.currentIndex]/2;
    if(this.camera.position.x>right&&this.currentIndex<this.halls.length-1&&this.isDoorOpen(this.halls[this.currentIndex+1].id)){this.currentIndex+=1;this.refresh();}
    else if(this.camera.position.x<left&&this.currentIndex>0&&this.isDoorOpen(this.halls[this.currentIndex].id)){this.currentIndex-=1;this.refresh();}
    this.loaded.get(this.halls[this.currentIndex].id)?.updateQuality(this.camera.position);
  }
  private updateVisibility():void{
    for(const [id,built] of this.loaded){const index=this.halls.findIndex(hall=>hall.id===id);if(index===this.currentIndex){built.group.visible=true;continue;}const connection=index>this.currentIndex?this.halls[this.currentIndex+1]?.id:this.halls[this.currentIndex]?.id;built.group.visible=Boolean(connection&&this.isDoorOpen(connection));}
  }
  private doorFor(hallId:string){for(const built of this.loaded.values())for(const door of built.doors)if(door.hallId===hallId)return door;return undefined;}
  private isDoorOpen(hallId:string):boolean{return Boolean(this.doorFor(hallId)?.isOpen);}
  colliders():Collider[]{
    const index=this.currentIndex,center=this.centers[index],width=this.widths[index],depth=8,wall=.45,gap=.95;const boxes:Collider[]=[];
    const side=(x:number,open:boolean)=>{if(!open){boxes.push({minX:x-wall/2,maxX:x+wall/2,minZ:-depth/2,maxZ:depth/2});return;}boxes.push({minX:x-wall/2,maxX:x+wall/2,minZ:-depth/2,maxZ:-gap},{minX:x-wall/2,maxX:x+wall/2,minZ:gap,maxZ:depth/2});};
    side(center-width/2,index>0&&this.isDoorOpen(this.halls[index].id));side(center+width/2,index<this.halls.length-1&&this.isDoorOpen(this.halls[index+1].id));
    boxes.push({minX:center-width/2,maxX:center+width/2,minZ:-depth/2-wall/2,maxZ:-depth/2+.3},{minX:center-width/2,maxX:center+width/2,minZ:depth/2-.3,maxZ:depth/2+wall/2});
    for(const item of this.loaded.get(this.halls[index].id)?.colliders??[])boxes.push('radius'in item?{...item,x:item.x+center}:{...item,minX:item.minX+center,maxX:item.maxX+center});
    return boxes;
  }
  objects():Object3D[]{
    const id=this.getHallId();const active=this.loaded.get(id);if(!active)return[];const objects:Object3D[]=[];
    active.group.traverse(object=>{if(object.userData.interaction)objects.push(object);});
    for(const built of this.loaded.values())if(built!==active)for(const door of built.doors)if(door.hallId===id)objects.push(door.object);
    return objects;
  }
  getHallId():string{return this.halls[this.currentIndex].id;}
  hallWidth(id:string):number{return this.widths[this.halls.findIndex(hall=>hall.id===id)]??10;}
  center(id:string):number{return this.centers[this.halls.findIndex(hall=>hall.id===id)]??0;}
  currentDoorState(id:string):boolean{return this.isDoorOpen(id);}
  highlightSource(paintingId:string|null):void{
    for(const built of this.loaded.values())built.group.traverse(object=>{
      if(object.userData.interaction?.type==='lectern'){
        const setActive=object.userData.setSourceActive as ((active:boolean)=>void)|undefined;
        setActive?.(paintingId!==null&&object.userData.interaction.id===paintingId);
      }
    });
  }
  updateDoors():void{this.refresh();}
  animateDoor(id:string):void{this.doorFor(id)?.animateOpen();}
  dispose():void{for(const built of this.loaded.values()){this.scene.remove(built.group);built.dispose();}this.loaded.clear();}
}
