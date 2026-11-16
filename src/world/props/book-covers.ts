import { BoxGeometry, Group, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three';

const covers=[
 {file:'cover-rubinstein.jpg',aspect:431/543},
 {file:'cover-lermontov.jpg',aspect:879/589},
 {file:'cover-pushkin.jpg',aspect:363/597},
];

export function createBookCoverDisplay(baseUrl:string):{group:Group;dispose():void}{
 const group=new Group();group.name='Обложки произведений у доски портретов';const loader=new TextureLoader();const textures:ReturnType<typeof loader.load>[]=[];
 covers.forEach((cover,index)=>{
  const item=new Group();item.position.set(0,3.35-index*.88,0);item.scale.setScalar(.62);
  const height=1.08,width=Math.min(1.18,height*cover.aspect);const wood=new MeshStandardMaterial({color:'#6d482b',roughness:.48});
  const backing=new Mesh(new BoxGeometry(width+.16,height+.16,.09),wood);item.add(backing);
  const border=new MeshStandardMaterial({color:'#c7a15b',metalness:.7,roughness:.32});
  for(const [w,h,x,y] of [[width+.06,.035,0,height/2+.015],[width+.06,.035,0,-height/2-.015],[.035,height+.06,-width/2-.015,0],[.035,height+.06,width/2+.015,0]]){const bar=new Mesh(new BoxGeometry(w,h,.055),border);bar.position.set(x,y,.055);item.add(bar);}
  const texture=loader.load(`${baseUrl}assets/tasks/${cover.file}`);texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;textures.push(texture);
  const image=new Mesh(new PlaneGeometry(width,height),new MeshStandardMaterial({map:texture,roughness:.95}));image.position.z=.052;item.add(image);group.add(item);
 });
 return{group,dispose(){textures.forEach(texture=>texture.dispose());}};
}
