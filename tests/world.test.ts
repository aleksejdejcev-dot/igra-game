import { describe, expect, it } from 'vitest';
import { collidesAABB, moveWithAABB, type AABB } from '../src/world/collision';
import { dimensionsForPaintings, layoutPaintings } from '../src/world/painting-layout';
import { forwardForYaw, rightForYaw } from '../src/world/controls';
import { Vector3 } from 'three';

const obstacle: AABB = { minX: 1, maxX: 2, minZ: 1, maxZ: 2 };
describe('AABB collision', () => {
  it('detects overlap including player radius', () => expect(collidesAABB({ x: .8, z: 1.5 }, [obstacle])).toBe(true));
  it('allows a clear position', () => expect(collidesAABB({ x: .5, z: .5 }, [obstacle])).toBe(false));
  it('slides along a blocked axis', () => expect(moveWithAABB({ x: .5, z: .5 }, { x: .8, z: .8 }, [obstacle])).toEqual({ x: 1.3, z: .7 }));
});
describe('painting wall layout', () => {
  it('scales width with the painting count', () => expect(dimensionsForPaintings(8).width).toBeGreaterThan(dimensionsForPaintings(2).width));
  it('places every painting on one of two walls inside the hall', () => {
    const dims = dimensionsForPaintings(5); const positions = layoutPaintings(['a','b','c','d','e'], dims);
    expect(positions).toHaveLength(5);
    expect(positions.every((item) => Math.abs(item.x) < dims.width / 2 && Math.abs(item.z) < dims.depth / 2)).toBe(true);
    expect(positions.filter((item) => item.side === 'north')).toHaveLength(3);
    expect(positions.filter((item) => item.side === 'south')).toHaveLength(2);
  });
});


describe('единые направления камеры и движения', () => {
  it('совпадает forward с поворотом камеры на восьми yaw', () => {
    for (let step=0; step<8; step+=1) {
      const yaw=step*Math.PI/4;
      const cameraForward=new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),yaw);
      expect(forwardForYaw(yaw).dot(cameraForward)).toBeGreaterThan(.999);
      expect(rightForYaw(yaw).length()).toBeCloseTo(1);
      expect(forwardForYaw(yaw).dot(rightForYaw(yaw))).toBeCloseTo(0);
    }
  });
  it('yaw ноль направляет W по -Z и вправо по +X', () => {
    expect(forwardForYaw(0).x).toBeCloseTo(0);expect(forwardForYaw(0).z).toBe(-1);
    expect(rightForYaw(0).x).toBe(1);expect(rightForYaw(0).z).toBeCloseTo(0);
  });
});
