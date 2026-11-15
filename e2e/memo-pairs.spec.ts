import { expect,test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.use({deviceScaleFactor:2});
test('мемо использует шесть полных пар на одинаковых карточках 4:3',async({page})=>{
 await mkdir('tools/shots/memo',{recursive:true});
 await page.goto('/dev.html?dev=1&task=memo');
 const cards=page.locator('.memo-card');await expect(cards).toHaveCount(12);
 const geometry=await cards.evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect(),img=element.querySelector('img')! as HTMLImageElement;return{width:rect.width,height:rect.height,ratio:rect.width/rect.height,pair:element.getAttribute('data-pair'),src:img.getAttribute('src'),fit:getComputedStyle(img).objectFit,naturalWidth:img.naturalWidth,imageRect:img.getBoundingClientRect().toJSON(),faceRect:img.parentElement!.getBoundingClientRect().toJSON()};}));
 const reference=geometry[0];for(const card of geometry){expect(Math.abs(card.width-reference.width)).toBeLessThanOrEqual(1);expect(Math.abs(card.height-reference.height)).toBeLessThanOrEqual(1);expect(card.ratio).toBeCloseTo(4/3,1);expect(card.fit).toBe('contain');expect(card.naturalWidth).toBeGreaterThan(0);for(const dimension of ['width','height'] as const){expect(Math.abs(card.imageRect[dimension]-card.faceRect[dimension])).toBeLessThanOrEqual(1);}}
 const pairs=new Map<string,typeof geometry>();for(const card of geometry){const pair=pairs.get(card.pair!)??[];pair.push(card);pairs.set(card.pair!,pair);}expect(pairs.size).toBe(6);for(const pair of pairs.values()){expect(pair).toHaveLength(2);expect(pair[0].src).toBe(pair[1].src);}
 await page.screenshot({path:'tools/shots/memo/closed.png'});
 await cards.evaluateAll(elements=>elements.forEach(element=>element.classList.add('is-open')));
 await page.waitForTimeout(400);
 const lastBox=await cards.last().boundingBox(),contentBox=await page.locator('.memo-task').boundingBox();expect(lastBox).not.toBeNull();expect(contentBox).not.toBeNull();expect(lastBox!.y+lastBox!.height).toBeLessThanOrEqual(contentBox!.y+contentBox!.height);
 await page.screenshot({path:'tools/shots/memo/open.png'});
});
