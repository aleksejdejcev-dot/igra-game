export interface PaintingPosition { id: string; x: number; y: number; z: number; rotationY: number; side: 'north' | 'south' }
export interface HallDimensions { width: number; depth: number; height: number }

export function dimensionsForPaintings(count: number): HallDimensions {
  const perWall = Math.ceil(Math.max(1, count) / 2);
  return { width: Math.max(10, perWall * 2.25 + 2), depth: 8, height: 4 };
}

export function layoutPaintings(ids: string[], dimensions: HallDimensions): PaintingPosition[] {
  const north = ids.filter((_, index) => index % 2 === 0);
  const south = ids.filter((_, index) => index % 2 === 1);
  const arrange = (wall: string[], side: 'north' | 'south'): PaintingPosition[] => wall.map((id, index) => ({
    id,
    x: -dimensions.width / 2 + dimensions.width * (index + 1) / (wall.length + 1),
    y: 2.05,
    // Keep the canvas clear of the inner wall face (wall thickness is 0.45 m).
    z: side === 'north' ? -dimensions.depth / 2 + 0.32 : dimensions.depth / 2 - 0.32,
    rotationY: side === 'north' ? 0 : Math.PI,
    side,
  }));
  return [...arrange(north, 'north'), ...arrange(south, 'south')];
}
