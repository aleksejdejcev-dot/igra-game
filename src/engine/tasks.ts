import type { GameStore } from './state';
import { calcPoints } from './scoring';
import halls from '../data/halls.json';
import { hallsEligibleToUnlock } from './progression';
import type { Hall } from '../ui/types';
import type { TaskConfig } from '../ui/types';

export interface TaskApi {
  attempt(ok: boolean): void;
  solve(): void;
  useHint(number: number): Promise<string | null>;
  loadDraft<T>(fallback: T): T;
  saveDraft(value: unknown): void;
}

export interface TaskModule {
  mount(el: HTMLElement, cfg: TaskConfig, api: TaskApi): void;
  destroy(): void;
}

export type TaskFactory = () => TaskModule | Promise<TaskModule>;
const registry = new Map<string, TaskFactory>();

export function registerTask(type: string, factory: TaskFactory): void { registry.set(type, factory); }
export function getTask(type: string): TaskFactory | undefined { return registry.get(type); }
export function taskApi(taskId: string, taskType: string, store: GameStore, askHint: (taskId: string, number: number) => Promise<string | null>): TaskApi {
  const draftKey = `closed-exhibition-1898:task-draft:${taskId}`;
  return {
    attempt: (ok) => store.attempt(taskId, ok),
    solve: () => {
      const task = store.state.solvedTasks[taskId] ?? { points: 0, attempts: 0, hintsUsed: 0 };
      const wrongAttempts = Math.max(0, task.attempts - 1);
      store.solve(taskId, calcPoints(wrongAttempts, task.hintsUsed, taskType));
      for(const hallId of hallsEligibleToUnlock(halls as Hall[],store.state.solvedTasks))store.unlockHall(hallId);
    },
    useHint: (number) => askHint(taskId, number),
    loadDraft: <T>(fallback: T): T => {
      try { const raw = localStorage.getItem(draftKey); return raw ? JSON.parse(raw) as T : fallback; }
      catch { return fallback; }
    },
    saveDraft: (value: unknown): void => {
      try { localStorage.setItem(draftKey, JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
    },
  };
}
