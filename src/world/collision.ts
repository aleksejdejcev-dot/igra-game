export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number }
export interface CircleCollider { x: number; z: number; radius: number }
export type Collider = AABB | CircleCollider;
export interface PlayerXZ { x: number; z: number }

const isCircle = (collider: Collider): collider is CircleCollider => 'radius' in collider;
export function collidesCollider(position: PlayerXZ, colliders: Collider[], radius = .3): boolean {
  return colliders.some((collider) => {
    if (isCircle(collider)) return Math.hypot(position.x - collider.x, position.z - collider.z) < radius + collider.radius;
    const closestX = Math.max(collider.minX, Math.min(position.x, collider.maxX));
    const closestZ = Math.max(collider.minZ, Math.min(position.z, collider.maxZ));
    return (position.x - closestX) ** 2 + (position.z - closestZ) ** 2 < radius ** 2;
  });
}
export function collidesAABB(position: PlayerXZ, colliders: AABB[], radius = .3): boolean {
  return collidesCollider(position, colliders, radius);
}

export function moveWithColliders(position: PlayerXZ, delta: PlayerXZ, colliders: Collider[], radius = .3, maxStep = .1): PlayerXZ & { blocked: boolean } {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / maxStep));
  const stepX = delta.x / steps; const stepZ = delta.z / steps; let x = position.x; let z = position.z;
  for (let step = 0; step < steps; step += 1) {
    const nextX = { x: x + stepX, z };
    if (!collidesCollider(nextX, colliders, radius)) x = nextX.x;
    const nextZ = { x, z: z + stepZ };
    if (!collidesCollider(nextZ, colliders, radius)) z = nextZ.z;
  }
  return { x, z, blocked: collidesCollider({ x, z }, colliders, radius) };
}

export function moveWithAABB(position: PlayerXZ, delta: PlayerXZ, colliders: AABB[], radius = .3): PlayerXZ {
  const { x, z } = moveWithColliders(position, delta, colliders, radius);
  return { x, z };
}
