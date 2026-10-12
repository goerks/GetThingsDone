import { useEffect } from 'react';

/**
 * Ctrl+N creates the item of the current page: a story on the board, the backlog and the story map, an epic on
 * the epics page, a release on the releases page. Each page registers its own action with this hook.
 * Calls `onNew` when the user presses Ctrl+N (Cmd+N on a Mac), unless a dialog is open or `enabled` is false.
 * The desktop app receives the key; many browsers keep Ctrl+N for a new window and never pass it on.
 */
export function useNewShortcut(onNew: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const isNew = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n';
      if (!isNew || event.defaultPrevented || event.isComposing) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      onNew();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNew, enabled]);
}
