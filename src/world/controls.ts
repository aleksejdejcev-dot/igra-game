import {
  Mesh, MeshBasicMaterial, Plane, Raycaster, RingGeometry, Vector2, Vector3,
  type Camera, type Scene,
} from 'three';
import { moveWithColliders, type Collider } from './collision';

export interface ControlSettings {
  sensitivity: number;
  invertY: boolean;
  sway: boolean;
}
export interface ControlSnapshot {
  yaw: number;
  pitch: number;
  position: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
  input: { forward: number; right: number };
  velocity: { x: number; z: number };
}

export function forwardForYaw(yaw: number): Vector3 {
  return new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}
export function rightForYaw(yaw: number): Vector3 {
  return new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

const MOVEMENT_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight',
]);
const isTyping = (target: EventTarget | null): boolean => target instanceof HTMLElement
  && (target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable="true"]')));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class FirstPersonControls {
  yaw = 0;
  pitch = 0;
  private velocity = new Vector2();
  private keys = new Set<string>();
  private touchAxes = new Vector2();
  private touchLook = false;
  private previousPointer = new Vector2();
  private pointerDownOrigin = new Vector2();
  private touchMoved = false;
  private dragging = false;
  private paused = false;
  private resumeLock = false;
  private lockAvailable = true;
  private goal: Vector3 | null = null;
  private stuckTime = 0;
  private swayTime = 0;
  private lookTarget: { yaw: number; elapsed: number; start: number } | null = null;
  private marker = new Mesh(new RingGeometry(.18, .25, 24), new MeshBasicMaterial({ color: '#e4bd69', transparent: true, opacity: .86, side: 2 }));
  private ray = new Raycaster();
  private floor = new Plane(new Vector3(0, 1, 0), 0);
  private settings: ControlSettings = { sensitivity: 1, invertY: false, sway: false };
  private joystick: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;
  private joystickPointer: number | null = null;
  private onLockChange: (locked: boolean) => void;

  constructor(
    private camera: Camera,
    private scene: Scene,
    private canvas: HTMLCanvasElement,
    private getColliders: () => Collider[],
    onLockChange: (locked: boolean) => void = () => undefined,
  ) {
    this.onLockChange = onLockChange;
    this.position.copy(camera.position);
    this.yaw = camera.rotation.y;
    this.pitch = camera.rotation.x;
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.canvas.style.touchAction = 'none';
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearKeys);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('mousemove', this.mouseMove);
    document.addEventListener('pointerlockchange', this.lockChange);
    document.addEventListener('pointerlockerror', this.lockError);
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointermove', this.touchPointerMove);
    this.canvas.addEventListener('pointerup', this.pointerUp);
    this.canvas.addEventListener('pointercancel', this.pointerUp);
  }

  position = new Vector3(0, 1.6, 0);
  get isPaused(): boolean { return this.paused; }

  updateSettings(settings: Partial<ControlSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  mountTouchControls(container: HTMLElement): void {
    if (!matchMedia('(pointer: coarse)').matches || this.joystick) return;
    const base = document.createElement('div');
    base.className = 'touch-joystick'; base.setAttribute('aria-label', 'Поворотный джойстик движения');
    const knob = document.createElement('span'); knob.className = 'touch-joystick-knob'; base.append(knob);
    container.append(base); this.joystick = base; this.joystickKnob = knob;
    const start = (event: PointerEvent) => { event.preventDefault(); this.joystickPointer = event.pointerId; base.setPointerCapture(event.pointerId); this.updateJoystick(event, base); };
    const move = (event: PointerEvent) => { if (this.joystickPointer === event.pointerId) this.updateJoystick(event, base); };
    const end = (event: PointerEvent) => { if (this.joystickPointer !== event.pointerId) return; this.joystickPointer = null; this.touchAxes.set(0, 0); knob.style.transform = 'translate(0, 0)'; };
    base.addEventListener('pointerdown', start); base.addEventListener('pointermove', move); base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  }

  private updateJoystick(event: PointerEvent, base: HTMLElement): void {
    const rect = base.getBoundingClientRect(); const radius = rect.width * .32;
    const dx = event.clientX - (rect.left + rect.width / 2); const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy); const scale = length > radius ? radius / length : 1;
    this.touchAxes.set(clamp(dx * scale / radius, -1, 1), clamp(-dy * scale / radius, -1, 1));
    this.joystickKnob?.style.setProperty('transform', `translate(${dx * scale}px, ${dy * scale}px)`);
  }

  private keyDown = (event: KeyboardEvent): void => {
    if (!MOVEMENT_CODES.has(event.code) || isTyping(event.target) || event.repeat || this.paused) return;
    event.preventDefault(); this.keys.add(event.code);
  };
  private keyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private clearKeys = (): void => { this.keys.clear(); this.velocity.set(0, 0); this.touchAxes.set(0, 0); this.goal=null;this.marker.visible=false;this.lookTarget=null;this.stuckTime=0; };
  private visibility = (): void => { if (document.hidden) { this.clearKeys(); this.dragging = false; this.touchLook = false; } };
  private lockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas;
    this.dragging = false;
    if (!locked) this.clearKeys();
    this.onLockChange(locked);
  };
  private lockError = (): void => { this.lockAvailable = false; };

  requestPointerLock(): void {
    if (this.paused || !this.lockAvailable || !this.canvas.requestPointerLock) { this.dragging = true; return; }
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.then === 'function') void result.catch(() => { this.lockAvailable = false; this.dragging = true; });
    } catch { this.lockAvailable = false; this.dragging = true; }
  }

  setPaused(value: boolean): void {
    if (this.paused === value) return;
    this.paused = value; this.clearKeys(); this.goal = null; this.marker.visible = false;
    if (value) {
      this.resumeLock = document.pointerLockElement === this.canvas;
      if (this.resumeLock) document.exitPointerLock();
    } else if (this.resumeLock) {
      this.resumeLock = false;
      queueMicrotask(() => this.requestPointerLock());
    }
  }

  private pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.paused) return;
    if (event.pointerType === 'touch' && matchMedia('(pointer: coarse)').matches) {
      const rect = this.canvas.getBoundingClientRect();
      if (event.clientX < rect.left + rect.width * .48) return;
      this.touchLook = true; this.touchMoved = false; this.previousPointer.set(event.clientX, event.clientY); this.pointerDownOrigin.set(event.clientX,event.clientY); this.canvas.setPointerCapture?.(event.pointerId);
      return;
    }
    if (document.pointerLockElement !== this.canvas) {
      this.dragging = true; this.previousPointer.set(event.clientX, event.clientY);
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Older browsers may not support capture. */ }
    }
  };
  private touchPointerMove = (event: PointerEvent): void => {
    if(!this.touchLook||event.pointerType!=='touch')return;
    const dx=event.clientX-this.previousPointer.x,dy=event.clientY-this.previousPointer.y;
    if(Math.hypot(event.clientX-this.pointerDownOrigin.x,event.clientY-this.pointerDownOrigin.y)>8)this.touchMoved=true;
    if(this.touchMoved)this.rotate(dx,dy);
    this.previousPointer.set(event.clientX,event.clientY);
  };
  private pointerUp = (event: PointerEvent): void => {
    if(!this.paused&&this.touchLook&&event.pointerType==='touch'&&!this.touchMoved)this.setFloorGoal(event.clientX,event.clientY);
    this.dragging = false; this.touchLook = false;
  };
  private setFloorGoal(clientX:number,clientY:number):void {
    const rect=this.canvas.getBoundingClientRect();const pointer=new Vector2((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
    this.ray.setFromCamera(pointer,this.camera);const point=this.ray.ray.intersectPlane(this.floor,new Vector3());
    if(point&&point.distanceTo(this.position)<8){this.moveTo(point.x,point.z);}
  }

  private mouseMove = (event: MouseEvent): void => {
    if (this.paused) return;
    if (document.pointerLockElement === this.canvas) this.rotate(event.movementX, event.movementY);
    else if (this.dragging || this.touchLook) {
      const x = 'clientX' in event ? event.clientX : this.previousPointer.x;
      const y = 'clientY' in event ? event.clientY : this.previousPointer.y;
      const dx = 'movementX' in event && this.dragging ? event.movementX : x - this.previousPointer.x;
      const dy = 'movementY' in event && this.dragging ? event.movementY : y - this.previousPointer.y;
      this.rotate(dx, dy); this.previousPointer.set(x, y);
    }
  };
  private rotate(dx: number, dy: number): void {
    if (Math.abs(dx) > 200 || Math.abs(dy) > 200) return;
    this.lookTarget = null;
    const sensitivity = .0022 * this.settings.sensitivity;
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch - dy * sensitivity * (this.settings.invertY ? -1 : 1), -85 * Math.PI / 180, 85 * Math.PI / 180);
  }

  moveTo(x: number, z: number): void {
    this.goal = new Vector3(x, this.position.y, z);
    this.marker.position.set(x, .025, z); this.marker.visible = true;
  }
  setPosition(x:number,y=1.6,z=0):void{this.position.set(x,y,z);this.camera.position.copy(this.position);this.cancelGoal();this.clearKeys();}
  cancelGoal(): void { this.goal = null; this.marker.visible = false; }
  setLookAt(point: Vector3): void {
    const direction = point.clone().sub(this.position); direction.y = 0;
    if (direction.lengthSq() > 0) this.lookTarget = { yaw: Math.atan2(-direction.x, -direction.z), elapsed: 0, start: this.yaw };
  }
  setAngles(yaw: number, pitch: number): void {
    this.yaw = yaw; this.pitch = clamp(pitch, -85 * Math.PI / 180, 85 * Math.PI / 180);
  }
  snapshot(): ControlSnapshot {
    const input = this.getInput(); const forward = forwardForYaw(this.yaw); const right = rightForYaw(this.yaw);
    return { yaw: this.yaw, pitch: this.pitch, position: { x: this.position.x, y: this.position.y, z: this.position.z }, forward: { x: forward.x, y: 0, z: forward.z }, right: { x: right.x, y: 0, z: right.z }, input, velocity: { x: this.velocity.x, z: this.velocity.y } };
  }

  private getInput(): { forward: number; right: number; sprint: boolean } {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) + this.touchAxes.y;
    const right = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.touchAxes.x;
    return { forward: clamp(forward, -1, 1), right: clamp(right, -1, 1), sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  update(deltaSeconds: number): void {
    const dt = clamp(deltaSeconds, 0, .05);
    if (this.paused || document.hidden) { this.clearKeys(); this.applyCamera(); return; }
    if (this.lookTarget) {
      this.lookTarget.elapsed += dt;
      const difference = Math.atan2(Math.sin(this.lookTarget.yaw - this.lookTarget.start), Math.cos(this.lookTarget.yaw - this.lookTarget.start));
      const t = clamp(this.lookTarget.elapsed / .3, 0, 1); const eased = t * t * (3 - 2 * t);
      this.yaw = this.lookTarget.start + difference * eased;
      if (t >= 1) this.lookTarget = null;
    }
    const input = this.getInput(); const wish = forwardForYaw(this.yaw).multiplyScalar(input.forward).add(rightForYaw(this.yaw).multiplyScalar(input.right));
    if (wish.lengthSq() > 1) wish.normalize();
    const maxSpeed = input.sprint ? 3.6 : 2.2;
    const target = wish.multiplyScalar(maxSpeed); const accelerating = target.lengthSq() > this.velocity.lengthSq();
    const maxChange = (target.lengthSq() === 0 ? Math.max(this.velocity.length(), 2.2) / .10 : maxSpeed / .12) * dt;
    const difference = new Vector2(target.x - this.velocity.x, target.z - this.velocity.y);
    if (difference.length() <= maxChange || difference.lengthSq() === 0) this.velocity.set(target.x, target.z);
    else this.velocity.addScaledVector(difference.normalize(), maxChange);
    if (!accelerating && target.lengthSq() === 0 && this.velocity.length() < .02) this.velocity.set(0, 0);

    let dx = this.velocity.x * dt; let dz = this.velocity.y * dt;
    if (this.goal) {
      const remainingX = this.goal.x - this.position.x; const remainingZ = this.goal.z - this.position.z;
      const remaining = Math.hypot(remainingX, remainingZ);
      if (remaining < .08) this.cancelGoal();
      else { const distance = Math.min(2.2 * dt, remaining); dx = remainingX / remaining * distance; dz = remainingZ / remaining * distance; }
    }
    const before = this.position.clone(); const moved = moveWithColliders({ x: this.position.x, z: this.position.z }, { x: dx, z: dz }, this.getColliders(), .3, .1);
    this.position.x = moved.x; this.position.z = moved.z; this.position.y = 1.6;
    const displacement = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    if (this.velocity.length() > .15 && displacement < .001) { this.stuckTime += dt; if (this.stuckTime > .5) { this.recoverFromStuck(); this.stuckTime = 0; } } else this.stuckTime = 0;
    if (this.settings.sway && this.velocity.length() > .15) this.swayTime += dt * 8; else this.swayTime = 0;
    this.applyCamera();
  }

  private recoverFromStuck(): void {
    const colliders = this.getColliders();
    for (let radius = .35; radius <= 1.05; radius += .1) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = this.position.x + Math.cos(angle) * radius; const z = this.position.z + Math.sin(angle) * radius;
      if (!moveWithColliders({ x, z }, { x: 0, z: 0 }, colliders, .3).blocked) { this.position.set(x, 1.6, z); return; }
    }
  }
  private applyCamera(): void {
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.y = this.yaw; this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0; this.camera.position.copy(this.position);
    if (this.settings.sway) this.camera.position.y += Math.sin(this.swayTime) * Math.min(.025, this.velocity.length() * .006);
  }

  destroy(): void {
    this.clearKeys(); this.windowRemove(); this.scene.remove(this.marker); this.marker.geometry.dispose(); this.marker.material.dispose(); this.joystick?.remove();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  dispose(): void { this.destroy(); }
  private windowRemove(): void {
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.clearKeys);
    document.removeEventListener('visibilitychange', this.visibility); document.removeEventListener('mousemove', this.mouseMove);
    document.removeEventListener('pointerlockchange', this.lockChange); document.removeEventListener('pointerlockerror', this.lockError);
    this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('pointermove', this.touchPointerMove); this.canvas.removeEventListener('pointerup', this.pointerUp); this.canvas.removeEventListener('pointercancel', this.pointerUp);
  }
}
