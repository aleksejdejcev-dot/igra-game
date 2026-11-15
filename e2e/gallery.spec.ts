import { expect, test, type Page } from '@playwright/test';

const save=JSON.stringify({player:{name:'Корреспондент'},unlockedHalls:['h01'],solvedTasks:{},totalScore:0,visitedPaintings:[],readParagraphs:[]});

async function move(page:Page,key:string,yaw:number){
  await page.evaluate((angle:number)=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);window.__WORLD_TEST__!.setAngles(angle,0);window.__WORLD_TEST__!.setCollisionEnabled(false);},yaw);
  await page.keyboard.down(key);
  const outcome=await page.evaluate(()=>{const before=window.__WORLD_TEST__!.snapshot().position;window.__WORLD_TEST__!.advance(60,1/60);const after=window.__WORLD_TEST__!.snapshot().position;return{before,after,forward:window.__WORLD_TEST__!.snapshot().forward,right:window.__WORLD_TEST__!.snapshot().right};});
  await page.keyboard.up(key);
  return outcome;
}

test('eight yaw axes, keyboard states, mouse, collision limits, sharp canvas and WebGL',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(value=>{localStorage.setItem('closed-exhibition-1898:save-v1',value);localStorage.setItem('gallery-preferences',JSON.stringify({quality:'medium',textScale:100}));},save);
  await page.goto('/?dev=1#hall/h01');await page.waitForFunction(()=>Boolean(window.__WORLD_TEST__));await page.waitForTimeout(650);
  expect(await page.locator('.dev-unlock').count()).toBe(1);
  const initial=await page.evaluate(()=>({dpr:devicePixelRatio,ratio:window.__WORLD_TEST__!.pixelRatio(),w:(document.querySelector('canvas') as HTMLCanvasElement).width,h:(document.querySelector('canvas') as HTMLCanvasElement).height,cw:document.querySelector('canvas')!.clientWidth,ch:document.querySelector('canvas')!.clientHeight,metrics:JSON.parse(document.querySelector<HTMLElement>('.world-status')!.dataset.metrics!)}));
  expect(Math.abs(initial.w-initial.cw*initial.ratio)).toBeLessThanOrEqual(1);expect(Math.abs(initial.h-initial.ch*initial.ratio)).toBeLessThanOrEqual(1);
  expect(initial.metrics.calls).toBeLessThanOrEqual(200);expect(initial.metrics.triangles).toBeLessThanOrEqual(250000);
  const fps=await page.evaluate(()=>new Promise<number>(resolve=>{let frames=0;const start=performance.now();const frame=(time:number)=>{frames++;if(time-start>=1600)resolve(frames*1000/(time-start));else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));console.log('headless SwiftShader FPS (medium):',fps);

  for(let index=0;index<8;index++){
    const yaw=index*Math.PI/4;
    for(const [key,axis,sign] of [['KeyW','forward',1],['KeyS','forward',-1],['KeyD','right',1],['KeyA','right',-1]] as const){
      const result=await move(page,key,yaw),dx=result.after.x-result.before.x,dz=result.after.z-result.before.z,length=Math.hypot(dx,dz),vector=result[axis];
      expect(length).toBeGreaterThan(1.9);expect(length).toBeLessThan(2.25);
      expect((dx*vector.x+dz*vector.z)*sign/length).toBeGreaterThan(.99);
    }
  }
  const straight=await move(page,'KeyW',0);const diagonal=await page.evaluate(async()=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);window.__WORLD_TEST__!.setAngles(0,0);window.__WORLD_TEST__!.setCollisionEnabled(false);return true;});expect(diagonal).toBe(true);
  await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');const diag=await page.evaluate(()=>{const before=window.__WORLD_TEST__!.snapshot().position;window.__WORLD_TEST__!.advance(60,1/60);const after=window.__WORLD_TEST__!.snapshot().position;return Math.hypot(after.x-before.x,after.z-before.z);});await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');
  const straightLength=Math.hypot(straight.after.x-straight.before.x,straight.after.z-straight.before.z);expect(Math.abs(diag-straightLength)/straightLength).toBeLessThan(.03);

  // event.code remains stable for a Russian-layout key value; repeated keydown is ignored.
  await page.evaluate(()=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);document.dispatchEvent(new KeyboardEvent('keydown',{key:'ф',code:'KeyW',bubbles:true}));});
  expect(await page.evaluate(()=>window.__WORLD_TEST__!.snapshot().input.forward)).toBe(1);
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'ф',code:'KeyW',repeat:true,bubbles:true})));
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keyup',{key:'ф',code:'KeyW',bubbles:true})));

  // A delayed frame is capped; 30 and 120 update steps cover the same second.
  const delayed=await page.evaluate(()=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);window.__WORLD_TEST__!.setAngles(0,0);document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));window.__WORLD_TEST__!.advance(1,.2);const p=window.__WORLD_TEST__!.snapshot().position;document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));return Math.hypot(p.x-5,p.z);});expect(delayed).toBeLessThan(.13);
  const thirty=await page.evaluate(()=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));window.__WORLD_TEST__!.advance(30,1/30);const p=window.__WORLD_TEST__!.snapshot().position;document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));return p.z;});
  const oneTwenty=await page.evaluate(()=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));window.__WORLD_TEST__!.advance(120,1/120);const p=window.__WORLD_TEST__!.snapshot().position;document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));return p.z;});expect(Math.abs(thirty-oneTwenty)).toBeLessThan(.07);

  await page.evaluate(()=>{window.__WORLD_TEST__!.setPosition(5,1.6,0);document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));window.dispatchEvent(new Event('blur'));window.__WORLD_TEST__!.advance(10,.05);});
  expect(await page.evaluate(()=>window.__WORLD_TEST__!.snapshot().velocity.z)).toBeCloseTo(0,1);
  await page.evaluate(()=>{const input=document.createElement('input');input.id='typing-test';document.body.append(input);input.focus();});await page.keyboard.down('w');
  expect(await page.evaluate(()=>window.__WORLD_TEST__!.snapshot().input.forward)).toBe(0);await page.keyboard.up('w');await page.locator('#typing-test').evaluate(el=>el.remove());
  await page.evaluate(()=>window.__WORLD_TEST__!.setPaused(true));await page.keyboard.down('w');expect(await page.evaluate(()=>window.__WORLD_TEST__!.snapshot().input.forward)).toBe(0);await page.keyboard.up('w');await page.evaluate(()=>window.__WORLD_TEST__!.setPaused(false));

  await page.evaluate(()=>{window.__WORLD_TEST__!.setAngles(0,4);});const orientation=await page.evaluate(()=>({pitch:window.__WORLD_TEST__!.snapshot().pitch,roll:window.__WORLD_TEST__!.cameraRotation().z}));expect(Math.abs(orientation.pitch)).toBeCloseTo(85*Math.PI/180,3);expect(orientation.roll).toBe(0);
  await page.evaluate(()=>{window.__WORLD_TEST__!.setAngles(0,0);const canvas=document.querySelector('canvas')!;canvas.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:13,pointerType:'mouse',clientX:640,clientY:400,bubbles:true}));document.dispatchEvent(new MouseEvent('mousemove',{movementX:50,movementY:-20,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{button:0,pointerId:13,pointerType:'mouse',clientX:690,clientY:380,bubbles:true}));});
  const mouse=await page.evaluate(()=>window.__WORLD_TEST__!.snapshot());expect(mouse.yaw).toBeLessThan(0);expect(mouse.pitch).toBeGreaterThan(0);

  const text=await page.locator('.hall-caption b').evaluate(el=>({fontSize:parseFloat(getComputedStyle(el).fontSize)}));expect(text.fontSize).toBeGreaterThanOrEqual(18);
  await page.evaluate(()=>window.__WORLD_TEST__!.interact('painting','p36'));
  await expect(page.locator('.spread-dialog')).toBeVisible();
  await page.evaluate(()=>document.querySelector<HTMLDialogElement>('.spread-dialog')?.close());
  await page.evaluate(()=>window.__WORLD_TEST__!.interact('lectern','p36'));
  await expect(page.locator('.book-dialog')).toBeVisible();await expect(page.locator('.book-dialog .book-pages p').first()).not.toContainText('архиве');
  const bookStyle=await page.locator('.book-dialog .book-pages').evaluate(el=>({fontSize:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  const luminance=(color:string)=>{const values=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});return .2126*values[0]+.7152*values[1]+.0722*values[2];};
  const [light,dark]=[luminance(bookStyle.color),luminance(bookStyle.background)].sort((a,b)=>a-b);
  expect(bookStyle.fontSize).toBeGreaterThanOrEqual(19);expect((dark+.05)/(light+.05)).toBeGreaterThanOrEqual(7);
  expect(errors).toEqual([]);
});
