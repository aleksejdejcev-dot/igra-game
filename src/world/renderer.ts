import { ACESFilmicToneMapping, PMREMGenerator, SRGBColorSpace, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export type RenderQuality='auto'|'low'|'medium'|'high';
export function maxPixelRatio():number{return Math.min(window.devicePixelRatio||1,1.5);}
export function pixelRatioForQuality(quality:RenderQuality):number {if(quality==='low')return 1;if(quality==='medium')return Math.min(maxPixelRatio(),1.5);return maxPixelRatio();}
export function applyPixelRatio(renderer:WebGLRenderer,ratio:number):void {renderer.setPixelRatio(Math.min(Math.max(1,ratio),1.5));renderer.setSize(document.documentElement.clientWidth,document.documentElement.clientHeight,false);}
export function createRenderer(canvas:HTMLCanvasElement,initialRatio=maxPixelRatio()):WebGLRenderer|null{
  try{const renderer=new WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',failIfMajorPerformanceCaveat:false});renderer.setPixelRatio(Math.min(initialRatio,1.5));renderer.setSize(document.documentElement.clientWidth,document.documentElement.clientHeight,false);renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=false;return renderer;}catch{return null;}
}
export function createGalleryEnvironment(renderer:WebGLRenderer):{texture:ReturnType<PMREMGenerator['fromScene']>['texture'];dispose():void}{
  const generator=new PMREMGenerator(renderer);const room=new RoomEnvironment();const result=generator.fromScene(room,.04);room.dispose();generator.dispose();return{texture:result.texture,dispose:()=>result.texture.dispose()};
}
export function bindRendererLifecycle(renderer:WebGLRenderer,render:(time:number)=>void):()=>void{
  const resize=()=>renderer.setSize(document.documentElement.clientWidth,document.documentElement.clientHeight,false);
  const visibility=()=>renderer.setAnimationLoop(document.hidden?null:render);const observer=new ResizeObserver(resize);observer.observe(document.documentElement);document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',resize);visibility();
  return()=>{renderer.setAnimationLoop(null);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);observer.disconnect();};
}
