import { Raycaster, Vector2, Vector3, type Camera, type Object3D, type Mesh, type Material } from 'three';
import type { FirstPersonControls } from './controls';

type Interactive = { type: string; id: string; label: string; onInteract(type: string, id: string): void };
export class InteractionController {
  private ray = new Raycaster();
  private pointer = new Vector2();
  private pointerInside = false;
  private hovered: Object3D | null = null;
  private selectedObject: Object3D | null = null;
  private list: Object3D[] = [];
  private onHover: (target: { object: Object3D; data: Interactive } | null) => void;

  constructor(
    private camera: Camera,
    private canvas: HTMLCanvasElement,
    private controls: FirstPersonControls,
    onHover: (target: { object: Object3D; data: Interactive } | null) => void = () => undefined,
  ) {
    this.ray.far = 3;
    this.onHover = onHover;
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerleave', this.leave);
    canvas.addEventListener('pointerdown', this.click);
    window.addEventListener('keydown', this.key);
  }

  setObjects(objects: Object3D[]): void {
    this.list = objects.filter((object) => Boolean(object.userData.interaction));
    this.list.sort((a, b) => this.distanceTo(a) - this.distanceTo(b));
    if (this.selectedObject && !this.list.includes(this.selectedObject)) this.selectedObject = null;
  }
  getSelection(): Object3D | null { return this.selectedObject ?? this.hovered; }

  private distanceTo(object: Object3D): number {
    const position = object.getWorldPosition(new Vector3());
    return position.distanceTo(this.camera.position);
  }
  private getTarget(obj: Object3D | null): { object: Object3D; data: Interactive } | null {
    for (let current = obj; current; current = current.parent) {
      if (current.userData.interaction) return { object: current, data: current.userData.interaction as Interactive };
    }
    return null;
  }
  private cast(): ReturnType<InteractionController['getTarget']> {
    if (!this.pointerInside && document.pointerLockElement !== this.canvas) return null;
    this.ray.setFromCamera(document.pointerLockElement === this.canvas ? new Vector2(0, 0) : this.pointer, this.camera);
    for (const hit of this.ray.intersectObjects(this.list, true)) {
      const target = this.getTarget(hit.object);
      if (target && target.object.getWorldPosition(new Vector3()).distanceTo(this.camera.position) <= 3) return target;
    }
    return null;
  }

  private move = (event: PointerEvent): void => {
    if (document.pointerLockElement === this.canvas) return;
    this.selectedObject = null; this.pointerInside = true;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
  };
  private leave = (): void => { this.pointerInside = false; if (!this.selectedObject) this.updateHover(null); };
  private click = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    if (document.pointerLockElement !== this.canvas) this.move(event);
    const target = this.cast();
    if (target) { this.controls.cancelGoal(); target.data.onInteract(target.data.type, target.data.id); return; }
    if (!matchMedia('(pointer: coarse)').matches) this.controls.requestPointerLock();
  };
  private key = (event: KeyboardEvent): void => {
    if (this.controls.isPaused || event.target instanceof HTMLElement && (event.target.closest('dialog') || event.target.isContentEditable || event.target.matches('input,textarea,select'))) return;
    if (event.code === 'Tab') {
      if (!this.list.length || (document.activeElement !== document.body && document.activeElement !== this.canvas)) return;
      event.preventDefault(); event.stopPropagation();
      const direction = event.shiftKey ? -1 : 1;
      const current = this.selectedObject ? this.list.indexOf(this.selectedObject) : -1;
      const next = (current + direction + this.list.length) % this.list.length;
      this.selectedObject = this.list[next]; this.pointerInside = false; this.updateHover(this.getTarget(this.selectedObject));
      const point = this.selectedObject.getWorldPosition(new Vector3()); this.controls.setLookAt(point);
      return;
    }
    if (!['KeyE', 'Enter', 'Space'].includes(event.code)) return;
    event.preventDefault();
    const target = (this.selectedObject && this.getTarget(this.selectedObject)) ?? this.cast() ?? this.getTarget(this.hovered);
    if (target) { this.controls.cancelGoal(); target.data.onInteract(target.data.type, target.data.id); }
  };

  private updateHover(target: ReturnType<InteractionController['getTarget']>): void {
    const next = target?.object ?? null;
    if (this.hovered !== next) {
      if (this.hovered) this.hovered.traverse((object) => {
        const mesh = object as Mesh; const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (material && 'emissive' in material && mesh.userData.previousEmissive) {
          (material as Material & { emissive: { copy(value: unknown): void } }).emissive.copy(mesh.userData.previousEmissive);
        }
      });
      this.hovered = next;
      if (next) next.traverse((object) => {
        const mesh = object as Mesh; const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (material && 'emissive' in material) {
          const emissive = (material as Material & { emissive: { clone(): unknown; set(value: string): void } }).emissive;
          mesh.userData.previousEmissive = emissive.clone(); emissive.set('#906527');
        }
      });
    }
    document.body.style.cursor = target ? 'pointer' : '';
    this.canvas.title = target?.data.label ?? '';
    this.onHover(target);
  }
  update(): void {
    const target = this.cast() ?? (this.selectedObject ? this.getTarget(this.selectedObject) : null);
    this.updateHover(target);
  }
  destroy(): void {
    this.canvas.removeEventListener('pointermove', this.move); this.canvas.removeEventListener('pointerleave', this.leave);
    this.canvas.removeEventListener('pointerdown', this.click); window.removeEventListener('keydown', this.key);
    this.updateHover(null); document.body.style.cursor = '';
  }
  dispose(): void { this.destroy(); }
}
