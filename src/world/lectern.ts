import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createLectern(id:string,label:string,onInteract:(type:string,id:string)=>void):Group {
  const group=new Group();
  const wood=new MeshStandardMaterial({color:'#422b1f',roughness:.48});
  const brass=new MeshStandardMaterial({color:'#b8904e',metalness:.74,roughness:.31});
  const leather=new MeshStandardMaterial({color:'#672b31',roughness:.78});
  const paper=new MeshStandardMaterial({color:'#e8dbbd',roughness:.95});
  const putBoxes=(material:MeshStandardMaterial,boxes:number[][])=>{
    const geometries=boxes.map(([w,h,d,x,y,z])=>{const geometry=new BoxGeometry(w,h,d);geometry.translate(x,y,z);return geometry;});
    const geometry=mergeGeometries(geometries,false);geometries.forEach(item=>item.dispose());
    if(geometry)group.add(new Mesh(geometry,material));
  };
  // The carved support, broad plinth and sloped desk are one static timber mesh.
  putBoxes(wood,[[.13,.68,.13,0,.43,0],[.62,.1,.48,0,.08,0],[.85,.08,.62,0,.83,-.03]]);
  putBoxes(brass,[[.035,.5,.035,-.18,.47,0],[.035,.5,.035,.18,.47,0],[.035,.04,.3,.25,.88,-.05]]);
  // Open red leather volume and its slightly inset leaves suggest a real source book.
  putBoxes(leather,[[.4,.035,.44,-.2,.89,-.04],[.4,.035,.44,.2,.89,-.04]]);
  putBoxes(paper,[[.36,.018,.4,-.2,.914,-.04],[.36,.018,.4,.2,.914,-.04]]);
  const bookmarkMaterial=new MeshStandardMaterial({color:'#a64036',emissive:'#000000',emissiveIntensity:.8,side:2});
  const bookmark=new Mesh(new PlaneGeometry(.035,.23),bookmarkMaterial);bookmark.position.set(.22,.933,-.04);group.add(bookmark);
  group.userData.interaction={type:'lectern',id,label,onInteract};
  group.userData.setSourceActive=(active:boolean)=>bookmarkMaterial.emissive.set(active?'#8f5b12':'#000000');
  group.userData.dispose=()=>{group.traverse(child=>{const mesh=child as Mesh;if(mesh.geometry)mesh.geometry.dispose();if(Array.isArray(mesh.material))mesh.material.forEach(item=>item.dispose());else if(mesh.material)mesh.material.dispose();});};
  return group;
}
