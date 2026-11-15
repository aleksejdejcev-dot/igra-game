import { getTask, registerTask } from '../engine/tasks';
export { getTask };

/** Task code is fetched only when the corresponding room object is opened. */
export function registerCoreTasks(): void {
  registerTask('memo', async () => (await import('./memo')).createMemo());
  registerTask('puzzle', async () => (await import('./puzzle')).createPuzzle());
  registerTask('match-captions', async () => (await import('./match-captions')).createMatchCaptions());
  registerTask('fill-words-repnin', async () => (await import('./fill-words')).createFillWords());
  registerTask('fill-words-monument', async () => (await import('./fill-words')).createFillWords());
  registerTask('crossword-names', async () => (await import('./crossword')).createCrossword());
  registerTask('crossword-authors', async () => (await import('./crossword')).createCrossword());
  registerTask('split-names', async () => (await import('./split-names')).createSplitNames());
  registerTask('drag-crown', async () => (await import('./drag-icons')).createDragIcons());
  registerTask('drag-figure', async () => (await import('./drag-icons')).createDragIcons());
  registerTask('combo-lock', async () => (await import('./combo-lock')).createComboLock());
  registerTask('chess', async () => (await import('./chess')).createChess());
  registerTask('gramophone', async () => (await import('./gramophone')).createGramophone());
  registerTask('connect-pairs', async () => (await import('./connect-pairs')).createConnectPairs());
}
