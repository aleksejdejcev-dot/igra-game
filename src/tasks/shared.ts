import type { TaskApi } from '../engine/tasks';
import type { TaskConfig } from '../ui/types';
import { TaskFrame } from '../ui/task-frame';
export type MountedTask = { frame: TaskFrame; api: TaskApi; cfg: TaskConfig; el: HTMLElement };
export function mountFrame(el: HTMLElement, cfg: TaskConfig, api: TaskApi, render: (task: MountedTask) => void): MountedTask {
  const close = () => el.closest('dialog')?.close();
  const frame = new TaskFrame(el, cfg, api, close);
  const task = { frame, api, cfg, el };
  render(task);
  const fields = [...frame.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')];
  const draft = api.loadDraft<{ fields?: Array<{ value: string; checked?: boolean }> }>({});
  fields.forEach((field, index) => {
    const saved = draft.fields?.[index];
    if (!saved || field.disabled) return;
    field.value = saved.value;
    if (field instanceof HTMLInputElement && typeof saved.checked === 'boolean') field.checked = saved.checked;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const saveFields = () => api.saveDraft({ ...api.loadDraft<Record<string, unknown>>({}),
    fields: [...frame.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')]
      .map(field => ({ value: field.value, ...(field instanceof HTMLInputElement ? { checked: field.checked } : {}) })),
  });
  frame.body.addEventListener('input', saveFields);
  frame.body.addEventListener('change', saveFields);
  return task;
}
export function normalizeWord(value: string): string { return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim(); }
