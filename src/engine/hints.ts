import hints from '../data/hints.json';

export interface HintEntry { taskId: string; hints: { text: string }[] }
const byTask = new Map((hints as HintEntry[]).map((entry) => [entry.taskId, entry.hints]));

export function getHint(taskId: string, number: number): string | null {
  return byTask.get(taskId)?.[number - 1]?.text ?? null;
}
