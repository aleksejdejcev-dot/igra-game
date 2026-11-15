import {
  BoxGeometry, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Group, LinearMipmapLinearFilter, Matrix4, Mesh, MeshStandardMaterial,
  PlaneGeometry, Quaternion, SRGBColorSpace, TextureLoader, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Painting } from '../ui/types';
import type { PaintingPosition } from './painting-layout';

export type PaintingDetail='thumb'|'medium'|'large';
export interface PaintingObject { id:string; group: Group; setActive(active: boolean): void; setDetail(detail:PaintingDetail):void; dispose(): void }

function makeTexture(source: HTMLImageElement, maximum:number): CanvasTexture {
  const scale = Math.min(1, maximum / Math.max(source.naturalWidth, source.naturalHeight));
  const width = Math.max(1, Math.round(source.naturalWidth * scale));
  const height = Math.max(1, Math.round(source.naturalHeight * scale));
  const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
  canvas.getContext('2d')?.drawImage(source,0,0,width,height);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.wrapS=texture.wrapT=ClampToEdgeWrapping;
  texture.minFilter=LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=16;texture.needsUpdate=true;return texture;
}

function plaqueTexture():CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const ctx=canvas.getContext('2d');if(ctx){const gradient=ctx.createLinearGradient(0,0,0,64);gradient.addColorStop(0,'#e2c57e');gradient.addColorStop(.45,'#8d6b35');gradient.addColorStop(1,'#392719');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,64);ctx.strokeStyle='#f1d797';ctx.lineWidth=3;ctx.strokeRect(7,7,242,50);ctx.fillStyle='#5f4524';ctx.beginPath();ctx.arc(22,32,4,0,Math.PI*2);ctx.arc(234,32,4,0,Math.PI*2);ctx.fill();}
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=true;return texture;
}

export function createPainting(painting:Painting,position:PaintingPosition,baseUrl:string,onInteract:(type:string,id:string)=>void,frameStyle='gilded'):PaintingObject {
  const group=new Group();group.position.set(position.x,position.y,position.z);group.rotation.y=position.rotationY;
  const frame=new MeshStandardMaterial({color:frameStyle==='plain'?'#211b19':frameStyle==='oak'?'#5a3822':'#c9a45e',metalness:frameStyle==='gilded'?.78:.18,roughness:frameStyle==='oak'?.42:.3});
  const liner=new MeshStandardMaterial({color:'#261815',roughness:.9});
  const velvet=new MeshStandardMaterial({color:'#541d29',roughness:.94});
  const planeMaterial=new MeshStandardMaterial({color:'#171111',roughness:.86});
  const plateMaterial=new MeshStandardMaterial({map:plaqueTexture(),roughness:.42,metalness:.65});
  let width=1.25,height=1.04;
  const mat=new Mesh(new PlaneGeometry(width+.16,height+.16),liner);mat.position.z=.012;group.add(mat);
  const matInner=new Mesh(new PlaneGeometry(width+.07,height+.07),velvet);matInner.position.z=.022;group.add(matInner);
  const plane=new Mesh(new PlaneGeometry(width,height),planeMaterial);plane.position.z=.036;group.add(plane);
  const plaque=new Mesh(new BoxGeometry(1.36,.18,.065),plateMaterial);plaque.position.set(0,-.72,.035);group.add(plaque);
  const frameMesh=new Mesh(new BufferGeometry(),frame);group.add(frameMesh);
  const rebuildFrame=()=>{const boxes=[[width+.18,.085,.13,0,height/2+.105,0],[width+.18,.085,.13,0,-height/2-.105,0],[.085,height+.21,.13,-width/2-.105,0,0],[.085,height+.21,.13,width/2+.105,0,0],[width+.34,.035,.045,0,height/2+.17,.07],[width+.34,.035,.045,0,-height/2-.17,.07],[.035,height+.34,.045,-width/2-.17,0,.07],[.035,height+.34,.045,width/2+.17,0,.07]];
    const geometries=boxes.map(([w,h,d,x,y,z])=>{const geometry=new BoxGeometry(w,h,d);geometry.applyMatrix4(new Matrix4().compose(new Vector3(x,y,z),new Quaternion(),new Vector3(1,1,1)));return geometry;});
    const merged=mergeGeometries(geometries,false);geometries.forEach(geometry=>geometry.dispose());frameMesh.geometry.dispose();if(merged)frameMesh.geometry=merged;
  };rebuildFrame();
  group.userData.interaction={type:'painting',id:painting.id,label:painting.caption,onInteract};
  const loader=new TextureLoader();let disposed=false,active=false,loadedDetail:PaintingDetail|null=null,requested:PaintingDetail|null=null,requestId=0;
  const files:Record<PaintingDetail,string>={thumb:painting.thumbnail,medium:painting.medium??painting.src,large:painting.large??painting.original??painting.src};
  const limits:Record<PaintingDetail,number>={thumb:400,medium:1024,large:2048};
  const apply=(detail:PaintingDetail,texture:CanvasTexture)=>{
    if(disposed||requested!==detail){texture.dispose();return;}
    planeMaterial.map?.dispose();planeMaterial.map=texture;planeMaterial.color.set('#fff');planeMaterial.needsUpdate=true;loadedDetail=detail;
    const image=texture.image as HTMLCanvasElement;const imageRatio=image.width/image.height;const maxW=1.68,maxH=1.3;width=imageRatio>maxW/maxH?maxW:maxH*imageRatio;height=width/imageRatio;
    mat.geometry.dispose();mat.geometry=new PlaneGeometry(width+.16,height+.16);matInner.geometry.dispose();matInner.geometry=new PlaneGeometry(width+.07,height+.07);plane.geometry.dispose();plane.geometry=new PlaneGeometry(width,height);
    const plaqueY=-height/2-.25;plaque.position.y=plaqueY;rebuildFrame();
  };
  const setDetail=(detail:PaintingDetail)=>{
    if(disposed||requested===detail||loadedDetail===detail)return;requested=detail;const id=++requestId;
    loader.load(`${baseUrl}assets/paintings/${files[detail]}`,raw=>{if(id!==requestId){raw.dispose();return;}const texture=makeTexture(raw.image as HTMLImageElement,limits[detail]);raw.dispose();apply(detail,texture);},undefined,()=>{if(detail!=='thumb'&&loadedDetail===null)setDetail('thumb');});
  };
  // The small image appears first; medium and large replace it after entry/proximity decisions.
  setDetail('thumb');
  return {id:painting.id,group,setActive(value){active=value;if(!active){requestId++;requested=null;loadedDetail=null;planeMaterial.map?.dispose();planeMaterial.map=null;planeMaterial.color.set('#171111');planeMaterial.needsUpdate=true;}else if(loadedDetail===null)setDetail('thumb');},setDetail(detail){if(active)setDetail(detail);},dispose(){disposed=true;requestId++;planeMaterial.map?.dispose();plateMaterial.map?.dispose();[mat,matInner,plane,plaque,frameMesh].forEach(mesh=>mesh.geometry.dispose());[frame,liner,velvet,planeMaterial,plateMaterial].forEach(material=>material.dispose());}};
}
