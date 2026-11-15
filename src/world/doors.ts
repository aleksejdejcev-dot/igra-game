import {
  BoxGeometry, CircleGeometry, Group, LatheGeometry, Material, Mesh, MeshStandardMaterial, Vector2,
} from 'three';
import type { BuiltDoor } from './types';

const woodFor: Record<string,string> = { oak:'#3b251b', ebony:'#211c1e', gilded:'#4b2b1d', plain:'#392d27' };
const brassColor = '#b88c49';
const brassPoints = [new Vector2(0,0),new Vector2(.018,.012),new Vector2(.026,.026),new Vector2(.016,.041),new Vector2(.013,.066),new Vector2(.025,.08),new Vector2(.031,.094),new Vector2(.018,.105),new Vector2(0,.108)];

export function createDoor(
  hallId: string,
  unlocked: boolean,
  shape: 'rect'|'arch',
  style: 'oak'|'ebony'|'gilded'|'plain',
  onInteract: (type:string,id:string)=>void,
  onUnlock: ()=>void = ()=>undefined,
): BuiltDoor {
  const object=new Group();
  const wood=new MeshStandardMaterial({color:woodFor[style]??woodFor.oak,roughness:.45,metalness:.08});
  const panelMaterial=new MeshStandardMaterial({color:style==='plain'?'#4b3830':'#302019',roughness:.58});
  const trim=new MeshStandardMaterial({color:style==='gilded'?'#d2ac68':brassColor,metalness:.9,roughness:.3});
  const dark=new MeshStandardMaterial({color:'#160f0d',roughness:.72});
  const add=(group:Group,geo:BoxGeometry|LatheGeometry|CircleGeometry,mat:MeshStandardMaterial,x:number,y:number,z:number)=>{const m=new Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;};

  // Both faces get a deep, moulded architrave; the opening itself is cut out of the wall by hall-builder.
  for(const face of [-1,1]) {
    const z=face*.253;
    for(const x of [-1.04,1.04]) {
      add(object,new BoxGeometry(.18,3.28,.14),trim,x,1.62,z);
      add(object,new BoxGeometry(.105,3.08,.18),wood,x,1.54,z-face*.055);
      add(object,new BoxGeometry(.028,2.92,.025),trim,x,1.55,z+face*.11);
    }
    if(shape==='rect'){
      add(object,new BoxGeometry(2.26,.2,.14),trim,0,3.08,z);
      add(object,new BoxGeometry(2.03,.09,.18),wood,0,2.93,z-face*.055);
      add(object,new BoxGeometry(2.38,.13,.28),trim,0,3.25,z);
      add(object,new BoxGeometry(2.05,.04,.02),wood,0,3.25,z+face*.15);
    }
  }
  // An elevated brass threshold sits flush with the finished floor.
  add(object,new BoxGeometry(1.94,.01,.45),trim,0,.005,0);
  // Door frame, 60 x 120 mm, lies in the full thickness of the portal wall.
  for(const x of [-.96,.96]) add(object,new BoxGeometry(.12,3,.45),wood,x,1.5,0);
  add(object,new BoxGeometry(2.04,.12,.45),wood,0,3,0);

  const leaves:Group[]=[];const lockCovers:Mesh[]=[];
  const makeLeaf=(side:-1|1)=>{
    const pivot=new Group(); pivot.position.set(side<0?-.92:.92,.02,0); object.add(pivot); leaves.push(pivot);
    const width=.92,height=shape==='arch'?2.48:2.9,innerWidth=.78,center=side<0?width/2:-width/2;
    add(pivot,new BoxGeometry(width,height,.06),wood,center,height/2,0);
    // Sunken field panels with raised moulding on each door face.
    const panelCount=shape==='arch'?3:4;const panelHeight=(height-.34)/panelCount;
    for(const face of [-1,1]) for(let row=0;row<panelCount;row+=1){
      const y=.12+row*panelHeight+panelHeight/2;const z=face*.041;
      add(pivot,new BoxGeometry(innerWidth+.04,panelHeight-.025,.025),trim,center,y,z);
      add(pivot,new BoxGeometry(innerWidth,panelHeight-.07,.03),panelMaterial,center,y,z+face*.015);
      add(pivot,new BoxGeometry(innerWidth-.1,panelHeight-.16,.018),wood,center,y,z+face*.032);
      add(pivot,new BoxGeometry(innerWidth-.16,panelHeight-.22,.016),panelMaterial,center,y,z+face*.043);
    }
    for(const face of [-1,1]){
      const z=face*.066;const handleX=center+(side<0?.33:-.33);
      const keyhole=add(pivot,new CircleGeometry(.018,16),dark,handleX,1.42,z+face*.015);keyhole.rotation.y=face*Math.PI/2;
      const handle=new Mesh(new LatheGeometry(brassPoints,10),trim);handle.position.set(handleX,1.57,z+face*.025);handle.rotation.x=Math.PI/2;handle.scale.set(.58,.58,.58);pivot.add(handle);
      const cover=add(pivot,new BoxGeometry(.13,.2,.035),trim,handleX,1.42,z+face*.018);lockCovers.push(cover);
      void keyhole;
    }
    return pivot;
  };
  makeLeaf(-1);makeLeaf(1);
  // Keep the opening simple: no glazed transom or decorative half-disc above the leaves.
  object.userData.interaction={type:'door',id:hallId,label:'Дверь',onInteract};
  let isOpen=false,targetOpen=false,phase:'idle'|'lock'|'leaf'='idle',elapsed=0,progress=0;
  const setOpen=(open:boolean)=>{
    if(targetOpen===open)return;targetOpen=open;elapsed=0;phase=open?'lock':'leaf';
    if(open)onUnlock();
  };
  if(unlocked){targetOpen=true;phase='idle';progress=1;isOpen=true;leaves[0].rotation.y=-Math.PI*100/180;leaves[1].rotation.y=Math.PI*100/180;}
  const update=(dt:number)=>{
    if(phase==='idle')return;
    elapsed+=dt;
    if(phase==='lock'){
      const lockT=Math.min(1,elapsed/.25);lockCovers.forEach((cover,index)=>{cover.rotation.z=(index%2?1:-1)*Math.sin(lockT*Math.PI)*.18;});
      if(lockT>=1){phase='leaf';elapsed=0;}
      return;
    }
    const t=Math.min(1,elapsed/1.2),ease=t*t*(3-2*t);progress=targetOpen?ease:1-ease;
    leaves[0].rotation.y=-progress*Math.PI*100/180;leaves[1].rotation.y=progress*Math.PI*100/180;
    if(t>=1){phase='idle';isOpen=targetOpen;}
  };
  return {id:hallId,hallId,object,mesh:leaves[0],leaves,get isOpen(){return isOpen;},get targetOpen(){return targetOpen;},animateOpen(){setOpen(true);},setOpen,update,dispose(){const materials=new Set<Material>();object.traverse(child=>{const mesh=child as Mesh;if(mesh.geometry)mesh.geometry.dispose();if(Array.isArray(mesh.material))mesh.material.forEach(material=>materials.add(material));else if(mesh.material)materials.add(mesh.material);});materials.forEach(material=>material.dispose());}};
}
