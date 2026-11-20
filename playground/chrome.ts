/**
 * Two controls DialKit's config can't express: a Random button beside the Preset select,
 * and one Copy button with a menu in place of DialKit's own "Copy parameters"
 * (which copies raw dial values, not a flow-hero patch). DialKit re-renders its
 * panel, so `ensure` re-adds them whenever they go missing.
 */
export interface CopyChoice {
  label: string;
  run: () => void;
}

const SHUFFLE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';
const CHEVRON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export function addPanelChrome(root: HTMLElement, onRandom: () => void, choices: readonly CopyChoice[]): () => void {
  const random = Object.assign(document.createElement('button'), { type: 'button', className: 'fh-random', title: 'Random look', innerHTML: SHUFFLE });
  random.setAttribute('aria-label', 'Random look');
  random.addEventListener('click', onRandom);

  const copy = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'dialkit-toolbar-add dialkit-toolbar-primary fh-copy',
    innerHTML: `<span>Copy</span>${CHEVRON}`,
  });
  copy.dataset.wide = 'true';
  copy.setAttribute('aria-haspopup', 'menu');
  copy.setAttribute('aria-expanded', 'false');

  const menu = Object.assign(document.createElement('div'), { className: 'fh-menu', role: 'menu' });
  menu.popover = 'auto';
  menu.setAttribute('aria-label', 'Copy as');
  const items: HTMLButtonElement[] = choices.map((c) => {
    const item = Object.assign(document.createElement('button'), { type: 'button', role: 'menuitem', textContent: c.label, tabIndex: -1 });
    item.addEventListener('click', () => {
      menu.hidePopover();
      c.run();
    });
    return item;
  });
  menu.append(...items);
  document.body.append(menu);

  copy.popoverTargetElement = menu;
  menu.addEventListener('toggle', (e) => {
    const open = (e as ToggleEvent).newState === 'open';
    copy.setAttribute('aria-expanded', String(open));
    if (open) {
      const r = copy.getBoundingClientRect();
      menu.style.top = `${r.bottom + 6}px`;
      menu.style.left = `${r.left}px`;
      menu.style.width = `${r.width}px`;
      items[0]?.focus();
    }
  });
  menu.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(i + step + items.length) % items.length]?.focus();
    }
  });

  const ensure = (): void => {
    const presetRow = [...root.querySelectorAll('.dialkit-select-row')].find((row) => row.textContent?.trim().startsWith('Preset'));
    if (presetRow && !presetRow.contains(random)) presetRow.append(random);
    const toolbar = root.querySelector('.dialkit-panel-toolbar');
    if (toolbar && !toolbar.contains(copy)) toolbar.prepend(copy);
  };
  const watcher = new MutationObserver(ensure);
  watcher.observe(root, { childList: true, subtree: true });
  ensure();

  return () => {
    watcher.disconnect();
    random.remove();
    copy.remove();
    menu.remove();
  };
}
