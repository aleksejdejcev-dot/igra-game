import { getTask, registerTask, type TaskModule } from '../engine/tasks';

class TaskStub implements TaskModule {
  mount(el: HTMLElement): void {
    el.innerHTML = '<p class="stub-note">За обложкой пока видны только листы чистой бумаги; дело будет приложено в следующем выпуске.</p>';
  }
  destroy(): void { /* The stub owns no external resources. */ }
}

export function registerTaskStubs(types: string[]): void {
  for (const type of types) if (!getTask(type)) registerTask(type, () => new TaskStub());
}
