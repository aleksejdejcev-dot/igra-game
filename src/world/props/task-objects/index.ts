import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, type Object3D } from 'three';
import type { Collider } from '../../collision';
import type { TaskConfig } from '../../../ui/types';

export type TaskObjectConfig={id:string;taskId:string;kind:string;position:[number,number,number];rotationY:number;label:string};
export type TaskObjectBuild={group:Group;collider:Collider;setSolved:(solved:boolean)=>void};
type Builder=(label:string)=>Group;
const builders:Record<string,Builder>={
  'memo-table':memoTable,
  'puzzle-easel':puzzleEasel,
  'match-board':matchBoard,
  'scroll-stand':scrollStand,
  'crossword-desk':crosswordDesk,
  'ad-column':adColumn,
  'triptych-screen':triptychScreen,
  'safe-cabinet':safeCabinet,
  'crown-case':crownCase,
  'figure-case':figureCase,
  'chess-table':chessTable,
  'gramophone-console':gramophoneConsole,
  'portrait-board':portraitBoard,
};
const wood=new MeshStandardMaterial({color:'#4a2c20',roughness:.78});
const darkWood=new MeshStandardMaterial({color:'#291c19',roughness:.8});
const brass=new MeshStandardMaterial({color:'#bd9250',metalness:.78,roughness:.32});
const paper=new MeshStandardMaterial({color:'#d9c69e',roughness:.94});
const red=new MeshStandardMaterial({color:'#6b2630',roughness:.74});
const litBrass=new MeshStandardMaterial({color:'#f5d07c',emissive:'#ffbd48',emissiveIntensity:0,metalness:.65,roughness:.25});
function box(parent:Group,w:number,h:number,d:number,x:number,y:number,z:number,material:MeshStandardMaterial):Mesh{const mesh=new Mesh(new BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function lamp(parent:Group):Mesh{const foot=new Mesh(new CylinderGeometry(.12,.18,.08,12),brass);foot.position.set(0,.93,0);parent.add(foot);const light=new Mesh(new SphereGeometry(.105,12,8),litBrass);light.position.set(0,1.08,0);parent.add(light);return light;}
function memoTable(label:string):Group{const g=new Group();g.name='Столик для карточной игры';box(g,1.32,.13,.9,0,.78,0,wood);for(const x of [-.52,.52])for(const z of [-.32,.32])box(g,.09,.76,.09,x,.37,z,darkWood);for(let i=0;i<6;i++){const card=box(g,.22,.025,.3,(i%3-.95)*.3,.88,Math.floor(i/3)*.18-.1,i%2?paper:red);card.rotation.y=(i%3)*.09;}lamp(g);g.userData.interactionLabel=label;return g;}
function puzzleEasel(label:string):Group{const g=new Group();g.name='Мольберт с мозаикой';box(g,1.18,1.18,.1,0,1.55,0,brass);box(g,1.02,1.02,.04,0,1.55,.08,darkWood);for(let i=1;i<4;i++)box(g,.018,1,.012,-.51+i*.255,1.55,.11,brass);for(let i=1;i<3;i++)box(g,1,.018,.012,0,1.55-.51+i*.34,.11,brass);for(const x of [-.52,.52]){const leg=box(g,.07,1.15,.07,x,.62,-.19,darkWood);leg.rotation.x=-.2;}box(g,1.1,.09,.32,0,.15,0,wood);lamp(g);g.userData.interactionLabel=label;return g;}
function matchBoard(label:string):Group{const g=new Group();g.name='Афишная тумба каталога';box(g,1.38,1.48,.14,0,1.68,0,darkWood);box(g,1.2,1.3,.06,0,1.68,.1,paper);for(let i=0;i<4;i++){const strip=box(g,1.08,.23,.045,0,2.13-i*.3,.145,i%2?paper:red);strip.userData.labelSlot=i;}for(const x of [-.48,.48]){box(g,.07,.86,.07,x,.43,.02,wood);const foot=box(g,.7,.09,.44,0,.08,.04,wood);void foot;}lamp(g);g.userData.interactionLabel=label;return g;}
function crosswordDesk(label:string):Group{const g=new Group();g.name='Конторка с газетной вырезкой';box(g,1.25,.14,.72,0,1.02,0,wood);for(const x of [-.5,.5])box(g,.12,.98,.12,x,.49,0,darkWood);box(g,.98,.56,.06,0,1.38,-.31,paper);for(let i=0;i<5;i++)box(g,.64,.012,.008,0,1.55-i*.075,-.265,i%2?red:brass);lamp(g);g.userData.interactionLabel=label;return g;}
function adColumn(label:string):Group{const g=new Group();g.name='Тумба с газетными вырезками';const body=new Mesh(new CylinderGeometry(.42,.48,1.55,16),darkWood);body.position.y=.83;g.add(body);for(let i=0;i<6;i++){const strip=box(g,.46,.24,.035,0,1.4-i*.22,.42,i%2?paper:red);strip.rotation.z=(i%2?.04:-.04);}lamp(g);g.userData.interactionLabel=label;return g;}
function triptychScreen(label:string):Group{const g=new Group();g.name='Ширма-триптих';for(let i=0;i<3;i++){box(g,.58,1.65,.09,(i-1)*.59,1.05,0,i===1?red:wood);for(const y of [.45,1.05,1.55])box(g,.42,.018,.015,(i-1)*.59,y,.055,brass);if(i<2){const hinge=box(g,.035,1.45,.035,(i-.5)*.59,1.05,-.03,brass);hinge.rotation.z=i===0?-.08:.08;}}lamp(g);g.userData.interactionLabel=label;return g;}
function safeCabinet(label:string):Group{const g=new Group();g.name='Шкаф-сейф с каруселью';box(g,1.4,1.7,.24,0,1.1,0,darkWood);box(g,1.15,1.4,.08,0,1.1,.16,brass);for(let i=0;i<3;i++){const win=new Mesh(new CylinderGeometry(.18,.18,.04,24),litBrass);win.rotation.x=Math.PI/2;win.position.set((i-1)*.34,1.35,.23);g.add(win);}const handle=new Mesh(new TorusGeometry(.17,.025,8,20),brass);handle.position.set(.62,1.05,.22);g.add(handle);lamp(g);g.userData.interactionLabel=label;return g;}
function caseProp(label:string,name:string,token:string):Group{const g=new Group();g.name=name;box(g,.94,.12,.75,0,.24,0,wood);for(const x of [-.43,.43])for(const z of [-.33,.33])box(g,.06,1.22,.06,x,.85,z,brass);box(g,.88,.06,.7,0,1.48,0,brass);for(const z of [-.3,.3])box(g,.88,.04,.04,0,.28,z,brass);const lid=box(g,.88,.04,.7,0,1.5,-.35,paper);lid.rotation.x=-.08;const geometry=token==='♛'?new CylinderGeometry(.16,.22,.15,8):new SphereGeometry(.16,12,8);const item=new Mesh(geometry,brass);item.position.set(0,.68,0);g.add(item);lamp(g);g.userData.interactionLabel=label;return g;}
function crownCase(label:string):Group{return caseProp(label,'Корона под стеклом','♛');}
function figureCase(label:string):Group{return caseProp(label,'Фигурка под стеклом','♟');}
function scrollStand(label:string):Group{const g=new Group();g.name='Пюпитр с рукописью';box(g,.85,.11,.65,0,.88,0,wood);for(const x of [-.31,.31]){const leg=box(g,.09,.86,.09,x,.43,.22,darkWood);leg.rotation.x=.2;}const leaf=box(g,.7,.025,.48,0,.96,0,paper);leaf.rotation.x=-.08;for(let i=0;i<4;i++){const rule=box(g,.44,.008,.008,0,.98-i*.04,.02,red);rule.rotation.x=-.08;}lamp(g);g.userData.interactionLabel=label;return g;}
function chessTable(label:string):Group{const g=new Group();g.name='Шахматный столик с записью партии';box(g,1.35,.12,1.35,0,.83,0,wood);for(const x of [-.55,.55])for(const z of [-.55,.55])box(g,.12,.82,.12,x,.4,z,darkWood);for(let y=0;y<8;y++)for(let x=0;x<8;x++)box(g,.15,.018,.15,(x-3.5)*.15,.9,(y-3.5)*.15,(x+y)%2?paper:darkWood);lamp(g);g.userData.interactionLabel=label;return g;}
function gramophoneConsole(label:string):Group{const g=new Group();g.name='Граммофон и пластинки';box(g,1.45,.14,.82,0,.88,0,wood);for(const x of [-.55,.55])for(const z of [-.28,.28])box(g,.09,.84,.09,x,.4,z,darkWood);const platter=new Mesh(new CylinderGeometry(.32,.32,.035,32),darkWood);platter.position.set(-.2,1,.02);g.add(platter);const horn=new Mesh(new ConeGeometry(.3,.55,24,1,true),brass);horn.rotation.z=-Math.PI/2;horn.position.set(.4,1.28,-.1);g.add(horn);box(g,.6,.035,.38,.1,1.4,-.38,paper);lamp(g);g.userData.interactionLabel=label;return g;}
function portraitBoard(label:string):Group{const g=new Group();g.name='Доска портретов артистов и литераторов';box(g,1.5,1.65,.14,0,1.55,0,darkWood);for(let i=0;i<6;i++){const x=(i%3-.95)*.43,y=2.03-Math.floor(i/3)*.72;box(g,.34,.55,.035,x,y,.1,brass);box(g,.28,.47,.025,x,y,.125,i%2?paper:red);}lamp(g);g.userData.interactionLabel=label;return g;}
export function buildTaskObject(config:TaskObjectConfig,task:TaskConfig,onInteract:(type:string,id:string)=>void):TaskObjectBuild|undefined{
  const build=builders[config.kind];if(!build)return;
  const group=build(config.label);group.position.set(...config.position);group.rotation.y=config.rotationY;group.userData.name=group.name;group.userData.taskObjectId=config.id;group.userData.taskId=config.taskId;group.userData.kind=config.kind;group.userData.taskState='idle';group.userData.interaction={type:'task',id:config.taskId,label:config.label,onInteract};
  const light=group.children.find((child:Object3D)=>child instanceof Mesh&&(child.material===litBrass)) as Mesh|undefined;
  group.userData.setSolved=(solved:boolean)=>{group.userData.taskState=solved?'solved':'idle';if(light){(light.material as MeshStandardMaterial).emissiveIntensity=solved?1.8:0;light.scale.setScalar(solved?1.3:1);}};
  const halfX=['match-board','crossword-desk','safe-cabinet','crown-case','figure-case'].includes(config.kind)?.7:config.kind==='triptych-screen'?1:.55,halfZ=.5;
  void task;
  return{group,collider:{minX:config.position[0]-halfX,maxX:config.position[0]+halfX,minZ:config.position[2]-halfZ,maxZ:config.position[2]+halfZ},setSolved:group.userData.setSolved};
}
