import type { Group, Object3D, Vector3 } from 'three';
import type { Hall, Painting, PaintingLink, TaskConfig } from '../ui/types';
import type { Collider } from './collision';

export interface HallBuildContext {
  hall: Hall;
  hallIndex: number;
  centerX: number;
  halls: Hall[];
  paintings: Painting[];
  links: PaintingLink[];
  tasks: TaskConfig[];
  unlockedHalls: Set<string>;
  baseUrl: string;
  onInteract: (type: string, id: string) => void;
  onDoorUnlock?: (hallId: string) => void;
}

export interface BuiltDoor { id: string; hallId: string; object: Group; mesh: Object3D; leaves: Group[]; isOpen: boolean; targetOpen: boolean; animateOpen(): void; setOpen(open: boolean): void; update(dt: number): void; dispose():void }
export interface BuiltHall { hallId: string; group: Group; colliders: Collider[]; doors: BuiltDoor[]; info: () => { calls: number; triangles: number; textures: number }; setActive(active: boolean): void; updateQuality(cameraPosition:Vector3):void; dispose(): void }
