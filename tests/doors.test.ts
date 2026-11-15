import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createDoor } from '../src/world/doors';
import { moveWithColliders } from '../src/world/collision';

describe('двери между залами',()=>{
  it('створки закрытой двери лежат в проёме, низ 2 см, петли по краям',()=>{
    const door=createDoor('h02',false,'rect','oak',()=>undefined);
    door.object.updateMatrixWorld(true);
    const bounds=door.leaves.map(leaf=>new Box3().setFromObject(leaf));
    expect(bounds[0].min.y).toBeCloseTo(.02,2);expect(bounds[1].min.y).toBeCloseTo(.02,2);
    expect(bounds[0].min.x).toBeGreaterThanOrEqual(-.95-.01);expect(bounds[1].max.x).toBeLessThanOrEqual(.95+.01);
    expect(door.leaves[0].position.x).toBeCloseTo(-.92);expect(door.leaves[1].position.x).toBeCloseTo(.92);
    door.dispose();
  });
  it('после щелчка замка створки открываются от внешних петель внутрь',()=>{
    const door=createDoor('h02',false,'arch','gilded',()=>undefined);door.setOpen(true);door.update(.25);door.update(1.2);door.object.updateMatrixWorld(true);
    expect(door.isOpen).toBe(true);
    expect(Math.abs(door.leaves[0].rotation.y)).toBeCloseTo(100*Math.PI/180,2);
    expect(Math.abs(door.leaves[1].rotation.y)).toBeCloseTo(100*Math.PI/180,2);
    door.dispose();
  });
  it('проход перекрыт стеной при закрытой двери и свободен в открытом проёме',()=>{
    const wall=[{minX:-.225,maxX:.225,minZ:-4,maxZ:4}];
    const closed=moveWithColliders({x:-.7,z:0},{x:1.4,z:0},wall);
    expect(closed.x).toBeLessThan(0);
    const open=[{minX:-.225,maxX:.225,minZ:-4,maxZ:-.95},{minX:-.225,maxX:.225,minZ:.95,maxZ:4}];
    const crossing=moveWithColliders({x:-.7,z:0},{x:1.4,z:0},open);
    expect(crossing.x).toBeGreaterThan(.6);expect(crossing.blocked).toBe(false);
  });
  it('100 направлений не прорывают стену за пределами дверного проёма',()=>{
    const wall=[{minX:-.225,maxX:.225,minZ:-4,maxZ:4}];
    for(let i=0;i<100;i++){
      const angle=i*2.399963229728653,dx=Math.cos(angle)*2.8,dz=Math.sin(angle)*2.8;
      const result=moveWithColliders({x:-.7,z:1.7},{x:dx,z:dz},wall);
      expect(result.x).toBeLessThanOrEqual(-.3+.001);
    }
  });
  it('объём створок конечен в мировых координатах',()=>{
    const door=createDoor('h02',true,'rect','ebony',()=>undefined);door.object.updateMatrixWorld(true);
    for(const leaf of door.leaves){const bounds=new Box3().setFromObject(leaf);expect(bounds.min.x).toBeGreaterThan(-2);expect(bounds.max.x).toBeLessThan(2);expect(bounds.min.y).toBeGreaterThanOrEqual(.01);expect(bounds.getSize(new Vector3()).length()).toBeGreaterThan(2);}
    door.dispose();
  });
});
