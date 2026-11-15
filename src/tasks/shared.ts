import type { TaskApi } from '../engine/tasks';
import type { TaskConfig } from '../ui/types';
import { TaskFrame } from '../ui/task-frame';
export type MountedTask = { frame: TaskFrame; api: TaskApi; cfg: TaskConfig; el: HTMLElement };
export function mountFrame(el: HTMLElement, cfg: TaskConfig, api: TaskApi, render: (task: MountedTask) => void): MountedTask {
  const close = () => el.closest('dialog')?.close();
  const frame = new TaskFrame(el, cfg, api, close);
  const task = { frame, api, cfg, el };
  render(task);
  return task;
}
export function normalizeWord(value: string): string { return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim(); }
