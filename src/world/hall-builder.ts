import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, InstancedMesh, Matrix4, Quaternion,
  ExtrudeGeometry, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Float32BufferAttribute, PlaneGeometry, PointLight, Points, PointsMaterial, RepeatWrapping, SRGBColorSpace, Shape,
  SphereGeometry, Vector3,
} from 'three';
import type { HallBuildContext, BuiltHall } from './types';
import type { Collider } from './collision';
import { createPainting } from './painting';
import { createLectern } from './lectern';
import { createDoor } from './doors';
import { dimensionsForPaintings, layoutPaintings } from './painting-layout';
import { buildTaskObject } from './props/task-objects';
import { createBookCoverDisplay } from './props/book-covers';

function texture(canvas:HTMLCanvasElement,repeatX=1,repeatY=1):CanvasTexture {
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.wrapS=RepeatWrapping;map.wrapT=RepeatWrapping;map.repeat.set(repeatX,repeatY);map.anisotropy=8;map.generateMipmaps=true;return map;
}
function damask(color:string):CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=color;ctx.fillRect(0,0,256,256);ctx.strokeStyle='rgba(210,174,112,.22)';ctx.lineWidth=2;
  for(let y=0;y<256;y+=64)for(let x=0;x<256;x+=64){ctx.save();ctx.translate(x+32,y+32);ctx.rotate(Math.PI/4);ctx.strokeRect(-17,-17,34,34);ctx.beginPath();ctx.ellipse(0,0,8,21,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.stroke();ctx.restore();}
  return texture(canvas);
}
function parquet(hallId:string):CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d')!;
  if(hallId==='h01'||hallId==='h07'){
    const size=64;for(let y=0;y<512;y+=size)for(let x=0;x<512;x+=size){const dark=(Math.floor(x/size)+Math.floor(y/size))%2===0;ctx.fillStyle=hallId==='h01'?(dark?'#bcae91':'#463a31'):(dark?'#211d1b':'#c0a978');ctx.fillRect(x,y,size,size);ctx.strokeStyle='rgba(245,220,172,.3)';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,size-2,size-2);}
  }else{
    ctx.fillStyle='#30251f';ctx.fillRect(0,0,512,512);
    for(let y=0;y<512;y+=64)for(let x=0;x<512;x+=128){const offset=(y/64)%2?64:0;ctx.fillStyle=((x+y)/64)%2?'#533b2a':'#725137';ctx.fillRect(x+offset,y,126,62);ctx.strokeStyle='#2b2019';ctx.lineWidth=3;ctx.strokeRect(x+offset+1,y+1,124,60);ctx.strokeStyle='rgba(227,188,124,.18)';ctx.strokeRect(x+offset+6,y+6,114,50);}
  }
  return texture(canvas,3,3);
}
function glowTexture():CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!;const g=ctx.createRadialGradient(64,64,2,64,64,62);g.addColorStop(0,'rgba(255,213,141,.42)');g.addColorStop(.45,'rgba(255,184,98,.16)');g.addColorStop(1,'rgba(255,171,78,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return texture(canvas);
}
function portalGeometry(depth:number,height:number,shape:'rect'|'arch'):ExtrudeGeometry {
  const outer=new Shape();outer.moveTo(-depth/2,0);outer.lineTo(depth/2,0);outer.lineTo(depth/2,height);outer.lineTo(-depth/2,height);outer.closePath();
  const opening=new (class extends Shape {})();
  opening.moveTo(-.95,0);opening.lineTo(-.95,shape==='arch'?2.5:3); 
  if(shape==='arch'){opening.absarc(0,2.5,.95,Math.PI,0,false);}else opening.lineTo(.95,3);
  opening.lineTo(.95,0);opening.closePath();outer.holes.push(opening);
  return new ExtrudeGeometry(outer,{depth:.45,bevelEnabled:false,steps:1,curveSegments:24});
}

export function buildHall(ctx:HallBuildContext):BuiltHall {
  const doors:ReturnType<typeof createDoor>[]=[];const paintingObjects:ReturnType<typeof createPainting>[]=[];const interactives:Group[]=[];const colliders:Collider[]=[];const disposeExtras:(()=>void)[]=[];
  const paintings=ctx.paintings.filter(p=>ctx.hall.paintingIds.includes(p.id));const dims=dimensionsForPaintings(paintings.length);const group=new Group();group.position.x=ctx.centerX;
  const wood=new MeshStandardMaterial({color:'#38271e',roughness:.48,metalness:.06});
  const panel=new MeshStandardMaterial({color:'#543126',roughness:.72});const brass=new MeshStandardMaterial({color:'#b78e4c',metalness:.85,roughness:.3});
  const ceiling=new MeshStandardMaterial({color:'#dfcfad',roughness:.92});const floorMap=parquet(ctx.hall.id);const floorMat=new MeshStandardMaterial({map:floorMap,roughness:ctx.hall.id==='h01'?.55:.38,metalness:.04});
  const wallMap=damask(ctx.hall.wallColor);const wallMat=new MeshStandardMaterial({color:'#d0c1a4',map:wallMap,roughness:.92,envMapIntensity:.16});
  const addBox=(w:number,h:number,d:number,x:number,y:number,z:number,material:MeshStandardMaterial):Mesh=>{const mesh=new Mesh(new BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  const repeated:Record<string,number[][]>={wood:[],brass:[],panel:[]};
  const addRepeated=(items:number[][],material:MeshStandardMaterial)=>{if(!items.length)return;const mesh=new InstancedMesh(new BoxGeometry(1,1,1),material,items.length);const matrix=new Matrix4(),rotation=new Quaternion();items.forEach(([w,h,d,x,y,z],index)=>{matrix.compose(new Vector3(x,y,z),rotation,new Vector3(w,h,d));mesh.setMatrixAt(index,matrix);});mesh.instanceMatrix.needsUpdate=true;group.add(mesh);};
  addBox(dims.width,.16,dims.depth,0,-.08,0,floorMat);
  addBox(dims.width,.18,dims.depth,0,dims.height+.09,0,ceiling);
  addBox(dims.width,dims.height,.45,0,dims.height/2,-dims.depth/2,wallMat);
  addBox(dims.width,dims.height,.45,0,dims.height/2,dims.depth/2,wallMat);
  // Shared east wall owns the portal. Its geometry contains the opening; there is no wall plane behind the door.
  const eastX=dims.width/2;
  if(ctx.hallIndex<ctx.halls.length-1){
    const shape=ctx.hall.doorShape??'rect';const portal=new Mesh(portalGeometry(dims.depth,dims.height,shape),wallMat);portal.rotation.y=Math.PI/2;portal.position.set(eastX-.225,0,0);group.add(portal);
    const next=ctx.halls[ctx.hallIndex+1];const door=createDoor(next.id,ctx.unlockedHalls.has(next.id),shape,ctx.hall.doorStyle??'oak',ctx.onInteract,()=>ctx.onDoorUnlock?.(next.id));door.object.position.set(eastX,0,0);door.object.rotation.y=Math.PI/2;group.add(door.object);doors.push(door);
  }else addBox(.45,dims.height,dims.depth,eastX,dims.height/2,0,wallMat);
  if(ctx.hallIndex===0)addBox(.45,dims.height,dims.depth,-dims.width/2,dims.height/2,0,wallMat);

  // Repeated profiles share instanced geometry to keep the frame budget low.
  const baseNorth=-dims.depth/2+.24,baseSouth=dims.depth/2-.24;
  for(const z of [baseNorth,baseSouth]){
    repeated.wood.push([dims.width,1.12,.15,0,.56,z],[dims.width,.05,.2,0,1.24,z],[dims.width,.18,.28,0,.09,z],[dims.width,.18,.3,0,3.76,z]);
    repeated.brass.push([dims.width,.13,.22,0,1.14,z],[dims.width,.035,.3,0,.2,z],[dims.width,.045,.32,0,3.63,z],[dims.width,.08,.34,0,3.86,z]);
    for(let x=-dims.width/2+1;x<dims.width/2-0.5;x+=1.5){repeated.brass.push([.055,.74,.12,x,.68,z-.04*Math.sign(z)],[1.18,.055,.12,x+.7,.32,z-.04*Math.sign(z)],[1.18,.055,.12,x+.7,1.04,z-.04*Math.sign(z)]);repeated.panel.push([1.02,.54,.025,x+.7,.68,z-.11*Math.sign(z)]);}
  }
  // Pilasters connect the lower panelling to the ceiling cornice.
  for(const z of [baseNorth,baseSouth])for(const x of [-dims.width/2+.25,dims.width/2-.25]){
    repeated.wood.push([.34,3.1,.34,x,2.05,z]);repeated.brass.push([.22,2.72,.36,x,2.05,z-Math.sign(z)*.2],[.55,.22,.48,x,3.68,z],[.48,.16,.44,x,.18,z]);repeated.panel.push([.1,2.6,.38,x,2.05,z-Math.sign(z)*.23]);
  }
  addRepeated(repeated.wood,wood);addRepeated(repeated.brass,brass);addRepeated(repeated.panel,panel);
  // Carved ceiling border and a central plaster rosette.
  addRepeated([[dims.width,.12,.35,0,3.96,-dims.depth/2+.18],[dims.width,.12,.35,0,3.96,dims.depth/2-.18]],brass);
  const rosette=new Mesh(new CircleGeometry(.72,48),new MeshStandardMaterial({color:'#d5c3a0',roughness:.88,side:DoubleSide}));rosette.rotation.x=-Math.PI/2;rosette.position.set(0,3.985,0);group.add(rosette);
  const ring=new Mesh(new CircleGeometry(.52,48),brass);ring.rotation.x=-Math.PI/2;ring.position.set(0,3.99,0);group.add(ring);

  const bulb=new MeshStandardMaterial({color:'#f9d99c',emissive:'#ffcb74',emissiveIntensity:1.5});
  group.add(new HemisphereLight('#ffe1b3','#211513',.24));
  for(const x of [-dims.width*.25,dims.width*.25]){
    const point=new PointLight('#ffd39a',2.8,7,1.7);point.position.set(x,3.24,0);group.add(point);
    const shade=new Mesh(new SphereGeometry(.22,10,8),bulb);shade.scale.set(1,.45,1);shade.position.set(x,3.58,0);group.add(shade);
    const cap=new Mesh(new CylinderGeometry(.28,.48,.12,12),wood);cap.position.set(x,3.38,0);group.add(cap);
  }
  const lightMap=glowTexture();const glowMat=new MeshBasicMaterial({map:lightMap,color:'#ffd28a',transparent:true,opacity:.24,blending:AdditiveBlending,depthWrite:false,side:DoubleSide});
  const linkIds=new Set(ctx.links.filter(link=>link.bookId).map(link=>link.paintingId).filter(Boolean));
  for(const position of layoutPaintings(paintings.map(p=>p.id),dims)){
    const painting=paintings.find(item=>item.id===position.id)!;const object=createPainting(painting,position,ctx.baseUrl,ctx.onInteract,ctx.hall.frameStyle);group.add(object.group);paintingObjects.push(object);
    const lamp=new Mesh(new BoxGeometry(.6,.045,.16),brass);lamp.position.set(position.x,2.88,position.z+(position.side==='north'?.15:-.15));group.add(lamp);
    const hotspot=new Mesh(new PlaneGeometry(1.9,2.05),glowMat);hotspot.position.set(position.x,1.95,position.z+(position.side==='north'?.2:-.2));hotspot.rotation.y=position.rotationY;group.add(hotspot);
    if(linkIds.has(painting.id)){const lectern=createLectern(painting.id,`Книга у картины «${painting.title}»`,ctx.onInteract);lectern.scale.setScalar(.9);lectern.position.set(position.x,0,position.side==='north'?-dims.depth/2+.62: dims.depth/2-.62);lectern.rotation.y=position.rotationY===0?0:Math.PI;group.add(lectern);interactives.push(lectern);colliders.push({minX:position.x-.38,maxX:position.x+.38,minZ:lectern.position.z-.34,maxZ:lectern.position.z+.34});}
  }
  const hallTasks=ctx.tasks.filter(task=>ctx.hall.taskIds.includes(task.id));
  const taskObjectIds=new Set((ctx.hall.taskObjects??[]).map(item=>item.taskId));
  hallTasks.filter(task=>!taskObjectIds.has(task.id)).forEach((task,index)=>{const x=-dims.width/2+dims.width*(index+1)/(hallTasks.length+1);const table=addBox(.72,.62,.56,x,.31,1.65,wood);table.userData.name='Игровой столик';table.userData.interaction={type:'task',id:task.id,label:'Игровой столик',onInteract:ctx.onInteract};colliders.push({minX:x-.4,maxX:x+.4,minZ:1.32,maxZ:1.98});});
  for(const config of ctx.hall.taskObjects??[]){const task=ctx.tasks.find(item=>item.id===config.taskId);if(!task)continue;const builtTask=buildTaskObject(config,task,ctx.onInteract);if(!builtTask)continue;group.add(builtTask.group);interactives.push(builtTask.group);colliders.push(builtTask.collider);}
  if(ctx.hall.id==='h04'){
    const sheet=new Group();sheet.name='Лист со стихотворением Репнина';const x=-1.5,z=-2.5,tilt=.38;
    const backing=new Mesh(new BoxGeometry(1.34,.035,.68),new MeshStandardMaterial({color:'#a98043',metalness:.38,roughness:.46}));backing.rotation.x=tilt;backing.position.set(x,.15,z);sheet.add(backing);
    const paperMat=new MeshStandardMaterial({color:'#f2dfb4',roughness:.96,side:DoubleSide});const leaf=new Mesh(new PlaneGeometry(1.25,.62),paperMat);leaf.rotation.x=-Math.PI/2+tilt;leaf.position.set(x,.174,z+.01);sheet.add(leaf);
    const ink=new MeshStandardMaterial({color:'#783b35',roughness:.8});for(let i=0;i<5;i++){const line=new Mesh(new BoxGeometry(.78-(i%2)*.12,.006,.012),ink);const lineZ=-.16+i*.08;line.rotation.x=tilt;line.position.set(x-.05,.175-lineZ*Math.sin(tilt),z+.01+lineZ*Math.cos(tilt));sheet.add(line);}
    const seal=new Mesh(new CircleGeometry(.075,20),new MeshStandardMaterial({color:'#8d3836',roughness:.74}));seal.rotation.x=-Math.PI/2+tilt;seal.position.set(x+.46,.175-.18*Math.sin(tilt),z+.01+.18*Math.cos(tilt));sheet.add(seal);
    const quill=new Mesh(new CylinderGeometry(.018,.034,.48,8),new MeshStandardMaterial({color:'#7f292c',roughness:.64,metalness:.08}));quill.position.set(x-.47,.25,z+.18);quill.rotation.z=-.16;sheet.add(quill);const quillNib=new Mesh(new ConeGeometry(.035,.12,8),new MeshStandardMaterial({color:'#bd9654',metalness:.6,roughness:.35}));quillNib.position.set(x-.43,.54,z+.18);quillNib.rotation.z=-.16;sheet.add(quillNib);
    const trailMat=new MeshStandardMaterial({color:'#d0a354',metalness:.7,roughness:.36,emissive:'#8a5a20',emissiveIntensity:.18});
    for(let i=0;i<8;i++){const t=i/7;const stud=new Mesh(new CircleGeometry(.045-i*.002,12),trailMat);stud.rotation.x=-Math.PI/2;stud.position.set(-1.5*t,.012,1.35-3.85*t);sheet.add(stud);}
    sheet.userData.name=sheet.name;sheet.userData.interaction={type:'document',id:'repnin-poem',label:'Стихотворный лист на золотистой подкладке у следа латунных гвоздиков',onInteract:ctx.onInteract};group.add(sheet);interactives.push(sheet);
  }

  // Small built-in alcove and a velvet bench differ by hall style and remain low-cost primitives.
  if(ctx.hall.props?.includes('throne')){
    const carpet=new Mesh(new BoxGeometry(3,.035,2.2),new MeshStandardMaterial({color:'#651f2d',roughness:.96}));carpet.position.set(0,.025,2.15);group.add(carpet);
    const seat=addBox(1.15,.22,.62,0,.72,2.2,panel);addBox(1.12,.95,.18,0,1.2,2.52,wood);addBox(.18,.62,.65,-.48,1.03,2.2,brass);addBox(.18,.62,.65,.48,1.03,2.2,brass);void seat;
  }
  const propKeys=new Set(ctx.hall.props??[]);
  if(propKeys.has('book-covers')){const display=createBookCoverDisplay(ctx.baseUrl);group.add(display.group);disposeExtras.push(display.dispose);}
  if(propKeys.has('banners'))for(const x of [-dims.width*.28,dims.width*.28]){
    addBox(.72,1.75,.08,x,2.52,-dims.depth/2+.3,new MeshStandardMaterial({color:'#762b35',roughness:.95}));addBox(.84,.06,.16,x,3.43,-dims.depth/2+.22,brass);const tip=new Mesh(new CylinderGeometry(0,.16,.28,4),brass);tip.rotation.z=Math.PI;tip.position.set(x,1.63,-dims.depth/2+.3);group.add(tip);
  }
  if(propKeys.has('iconostasis')){
    for(const x of [-1.5,0,1.5]){addBox(.11,2.6,.18,x,2.35,-dims.depth/2+.23,brass);addBox(.88,1.62,.08,x,2.33,-dims.depth/2+.29,new MeshStandardMaterial({color:'#283039',roughness:.8}));const halo=new Mesh(new CircleGeometry(.22,24),new MeshBasicMaterial({color:'#c39e5d'}));halo.position.set(x,2.55,-dims.depth/2+.22);group.add(halo);}
  }
  if(propKeys.has('lamps'))for(const x of [-2.5,2.5]){const flame=new Mesh(new SphereGeometry(.12,8,6),bulb);flame.position.set(x,1.52,-dims.depth/2+.42);group.add(flame);addBox(.08,.55,.08,x,1.2,-dims.depth/2+.42,brass);}
  if(propKeys.has('cradle')){
    addBox(1.05,.14,.7,0,.54,2.4,wood);for(const x of [-.5,.5])addBox(.08,.62,.74,x,.82,2.4,brass);addBox(.92,.48,.05,0,.82,2.74,wood);for(const x of [-.35,.35])addBox(.06,.46,.06,x,.2,2.4,wood);
  }
  if(propKeys.has('curtains'))for(const x of [-dims.width*.27,dims.width*.27]){addBox(.07,2.25,.13,x-.55,2.47,-dims.depth/2+.27,brass);for(let fold=0;fold<5;fold++)addBox(.16,1.95,.1,x-.38+fold*.19,2.38,-dims.depth/2+.35,new MeshStandardMaterial({color:fold%2?'#8e5c50':'#69423c',roughness:.93}));}
  if(propKeys.has('monument')){
    const bronze=new MeshStandardMaterial({color:'#766444',metalness:.7,roughness:.39});const pedestal=addBox(1.9,.45,1.9,0,.22,0,bronze);void pedestal;
    for(const x of [-.52,-.18,.18,.52]){const plinth=addBox(.2,.75,.2,x,.82,0,bronze);plinth.rotation.z=x*.12;addBox(.38,.16,.34,x,1.29,0,brass);}
    const dome=new Mesh(new SphereGeometry(.34,12,8,0,Math.PI*2,0,Math.PI/2),bronze);dome.position.set(0,1.38,0);group.add(dome);
  }
  if(propKeys.has('gramophone')){
    addBox(.9,.12,.75,0,.62,2.2,wood);for(const x of [-.34,.34])addBox(.08,.6,.08,x,.3,2.2,brass);
    const horn=new Mesh(new CylinderGeometry(.08,.52,.62,18,1,true),new MeshStandardMaterial({color:'#c69b51',metalness:.78,roughness:.3,side:DoubleSide}));horn.rotation.x=Math.PI/2;horn.position.set(0,1.24,2.15);group.add(horn);
  }
  if(propKeys.has('chests'))for(const x of [-1.1,1.1]){addBox(1.25,.62,.75,x,.32,2.2,wood);addBox(1.3,.1,.8,x,.65,2.2,brass);addBox(.09,.35,.06,x,.39,1.8,brass);}
  if(propKeys.has('editor-desk')){addBox(1.9,.16,.9,0,.82,2.25,wood);for(const x of [-.78,.78])addBox(.14,.75,.72,x,.4,2.25,brass);addBox(.54,.03,.4,-.35,.92,2.2,new MeshStandardMaterial({color:'#e4d3ad',roughness:1}));const lamp=new Mesh(new CylinderGeometry(.04,.2,.22,12),bulb);lamp.position.set(.52,1.02,2.1);group.add(lamp);}
  if(ctx.hall.props?.includes('bench')){addBox(1.8,.28,.52,0,.42,2.1,wood);for(const x of [-.65,.65])addBox(.12,.42,.16,x,.21,2.1,brass);}
  if(ctx.hall.props?.includes('chandelier')){
    const chain=new Mesh(new CylinderGeometry(.025,.025,.62,8),brass);chain.position.set(0,3.48,0);group.add(chain);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const arm=new Mesh(new CylinderGeometry(.02,.02,.72,6),brass);arm.position.set(Math.cos(a)*.48,3.05,Math.sin(a)*.48);arm.rotation.z=Math.PI/2;arm.rotation.y=a;group.add(arm);const flame=new Mesh(new SphereGeometry(.1,8,6),bulb);flame.position.set(Math.cos(a)*.78,3.12,Math.sin(a)*.78);group.add(flame);}
  }
  // A restrained dust cloud catches the warm lamps without introducing real shadows.
  const dustPositions=new Float32Array(90*3);let seed=ctx.hallIndex+13;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<90;i++){dustPositions[i*3]=(rand()-.5)*dims.width;dustPositions[i*3+1]=.8+rand()*2.4;dustPositions[i*3+2]=(rand()-.5)*dims.depth;}
  const dustGeometry=new BufferGeometry();dustGeometry.setAttribute('position',new Float32BufferAttribute(dustPositions,3));
  const dust=new Points(dustGeometry,new PointsMaterial({color:'#f3d49e',size:.018,transparent:true,opacity:.32,depthWrite:false}));group.add(dust);
  const adjustDoors=(open:Set<string>)=>{for(const door of doors)door.setOpen(open.has(door.hallId));};
  const built:BuiltHall={hallId:ctx.hall.id,group,colliders,doors,info:()=>({calls:0,triangles:0,textures:0}),setActive(active){paintingObjects.forEach(p=>{p.setActive(active);if(active)p.setDetail('medium');});},updateQuality(cameraPosition){group.updateWorldMatrix(true,false);const near=paintingObjects.map(p=>({p,d:p.group.getWorldPosition(new Vector3()).distanceTo(cameraPosition)})).filter(item=>item.d<2.5).sort((a,b)=>a.d-b.d);const large=new Set(near.slice(0,6).map(item=>item.p.id));paintingObjects.forEach(p=>p.setDetail(large.has(p.id)?'large':'medium'));},dispose(){group.traverse(object=>{const mesh=object as Mesh;if(mesh.geometry)mesh.geometry.dispose();if(Array.isArray(mesh.material))mesh.material.forEach(material=>material.dispose());else if(mesh.material)mesh.material.dispose();});disposeExtras.forEach(dispose=>dispose());floorMap.dispose();wallMap.dispose();lightMap.dispose();paintingObjects.forEach(p=>p.dispose());void interactives;}};
  adjustDoors(ctx.unlockedHalls);return built;
}
