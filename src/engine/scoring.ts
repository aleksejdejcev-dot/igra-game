export function calcPoints(wrongAttempts: number, hintsUsed: number, taskType = ''): number {
  const misses = Math.max(0, Math.floor(wrongAttempts));
  const hints = Math.max(0, Math.min(3, Math.floor(hintsUsed)));
  const hintDiscount = hints === 0 ? 0 : hints === 1 ? (taskType === 'chess' ? 50 : 25) : hints === 2 ? 40 : 50;
  return Math.max(20, 100 - misses * 10 - hintDiscount);
}

export function hintCostPercent(hintNumber: number, taskType = ''): number {
  const hint = Math.max(1, Math.min(3, Math.floor(hintNumber)));
  if (hint === 1 && taskType === 'chess') return 50;
  return hint === 1 ? 25 : hint === 2 ? 40 : 50;
}
