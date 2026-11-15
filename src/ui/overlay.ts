export interface OverlayOptions {
  pause?: (paused: boolean) => void;
  beforeClose?: () => void;
}

const openDialogs = new WeakSet<HTMLDialogElement>();

export function openOverlay(dialog: HTMLDialogElement, options: OverlayOptions = {}): void {
  if (openDialogs.has(dialog)) return;
  openDialogs.add(dialog);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const hadPointerLock = Boolean(document.pointerLockElement);
  options.pause?.(true);
  dialog.setAttribute('aria-modal', 'true');
  const focusable = (): HTMLElement[] => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')];
  const close = (): void => {
    options.beforeClose?.();
    options.pause?.(false);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    if (hadPointerLock && !options.pause) previousFocus?.requestPointerLock?.();
    openDialogs.delete(dialog);
  };
  const trap = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) { event.preventDefault(); dialog.focus(); return; }
    const first = items[0], last = items.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  dialog.addEventListener('keydown', trap);
  dialog.addEventListener('close', close, { once: true });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.showModal();
  (focusable()[0] ?? dialog).focus({ preventScroll: true });
}
