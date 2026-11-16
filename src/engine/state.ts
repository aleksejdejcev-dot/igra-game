import halls from '../data/halls.json';
import type { Hall } from '../ui/types';
import { hallsEligibleToUnlock } from './progression';

export interface SolvedTaskState {
  points: number;
  attempts: number;
  hintsUsed: number;
}

export interface GameState {
  player: { name: string } | null;
  unlockedHalls: string[];
  solvedTasks: Record<string, SolvedTaskState>;
  totalScore: number;
  visitedPaintings: string[];
  readParagraphs: string[];
  finaleResponse: string | null;
}

const STORAGE_KEY = 'closed-exhibition-1898:save-v1';
const initialState = (): GameState => ({
  player: null,
  unlockedHalls: ['h01'],
  solvedTasks: {},
  totalScore: 0,
  visitedPaintings: [],
  readParagraphs: [],
  finaleResponse: null,
});

function readSavedState(): GameState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return initialState();
    const saved = parsed as Partial<GameState>;
    const solvedTasks = saved.solvedTasks && typeof saved.solvedTasks === 'object' ? saved.solvedTasks : {};
    const totalScore = Object.values(solvedTasks).reduce((sum, task) => sum + (Number(task?.points) || 0), 0);
    const unlockedHalls = hallsEligibleToUnlock(halls as Hall[], solvedTasks);
    const state: GameState = {
      player: saved.player && typeof saved.player.name === 'string' ? { name: saved.player.name.slice(0, 60) } : null,
      unlockedHalls,
      solvedTasks,
      totalScore,
      visitedPaintings: Array.isArray(saved.visitedPaintings) ? saved.visitedPaintings.filter((id) => typeof id === 'string') : [],
      readParagraphs: Array.isArray(saved.readParagraphs) ? saved.readParagraphs.filter((id) => typeof id === 'string') : [],
      finaleResponse: typeof saved.finaleResponse==='string'?saved.finaleResponse:null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return initialState();
  }
}

export class GameStore {
  private value: GameState = readSavedState();
  private listeners = new Set<(state: GameState) => void>();

  get state(): GameState { return structuredClone(this.value); }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  start(name: string): void {
    const cleanName = Array.from(name.trim()).slice(0, 24).join('');
    if (!cleanName) return;
    this.change((state) => ({ ...state, player: { name: cleanName } }));
  }

  reset(): void {
    this.value = initialState();
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith('closed-exhibition-1898:task-draft:') || key?.startsWith('gallery-crossword:')) localStorage.removeItem(key);
      }
    } catch { /* Storage can be disabled. */ }
    this.persist();
    this.notify();
  }

  unlockHall(hallId: string): void {
    this.change((state) => ({ ...state, unlockedHalls: [...new Set([...state.unlockedHalls, hallId])] }));
  }

  visitPainting(paintingId: string): void {
    this.change((state) => ({ ...state, visitedPaintings: [...new Set([...state.visitedPaintings, paintingId])] }));
  }

  readParagraph(paragraphId: string): void {
    this.change((state) => ({ ...state, readParagraphs: [...new Set([...state.readParagraphs, paragraphId])] }));
  }

  saveFinaleResponse(response:string):void{this.change(state=>({...state,finaleResponse:response.slice(0,5000)}));}

  attempt(taskId: string, ok: boolean): void {
    this.change((state) => {
      const task = state.solvedTasks[taskId] ?? { points: 0, attempts: 0, hintsUsed: 0 };
      if (ok && task.points > 0) return state;
      return { ...state, solvedTasks: { ...state.solvedTasks, [taskId]: { ...task, attempts: task.attempts + 1 } } };
    });
  }

  addHint(taskId: string): number {
    let used = 0;
    this.change((state) => {
      const task = state.solvedTasks[taskId] ?? { points: 0, attempts: 0, hintsUsed: 0 };
      used = Math.min(3, task.hintsUsed + 1);
      return { ...state, solvedTasks: { ...state.solvedTasks, [taskId]: { ...task, hintsUsed: used } } };
    });
    return used;
  }

  solve(taskId: string, points: number): void {
    this.change((state) => {
      const task = state.solvedTasks[taskId] ?? { points: 0, attempts: 0, hintsUsed: 0 };
      return { ...state, solvedTasks: { ...state.solvedTasks, [taskId]: { ...task, points: Math.max(task.points, points) } } };
    });
  }

  private change(update: (state: GameState) => GameState): void {
    this.value = update(this.value);
    this.value.totalScore = Object.values(this.value.solvedTasks).reduce((sum, task) => sum + task.points, 0);
    this.persist();
    this.notify();
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value)); } catch { /* Storage can be disabled. */ }
  }

  private notify(): void { for (const listener of this.listeners) listener(this.state); }
}

export const gameStore = new GameStore();
