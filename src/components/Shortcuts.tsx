import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Route } from '../router';
import { Dialog } from './Dialog';
import { modKey } from './platform';

interface Entry {
  keys: string[];
  label: string;
}

/** Opens the overview with Ctrl+/ (Cmd+/ on a Mac), unless a dialog is already open. */
export function useShortcutsKey(onOpen: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key !== '/' || event.defaultPrevented) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="shortcut__keys">
      {keys.map((key, index) => (
        <span key={key}>
          {index > 0 && <span aria-hidden="true"> + </span>}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  );
}

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <section className="shortcut__group">
      <h3>{title}</h3>
      <dl className="shortcut__list">
        {entries.map((entry) => (
          <div key={entry.label} className="shortcut__row">
            <dt>{entry.label}</dt>
            <dd>
              <Keys keys={entry.keys} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * All keyboard shortcuts, the ones of the current page first (#32, Q6). Only shortcuts that exist are listed.
 * The shortcuts of this overview are combinations with Ctrl (Cmd); the only single key is `?` for the help (#33).
 */
export function ShortcutsDialog({ route, onClose }: { route: Route; onClose: () => void }) {
  const { t } = useTranslation();
  const mod = modKey();
  const onCards = route.name === 'board' || route.name === 'backlog' || route.name === 'map';
  const newLabel =
    route.name === 'epics' ? t('shortcuts.newEpic') : route.name === 'releases' ? t('shortcuts.newRelease') : route.name === 'settings' ? null : t('shortcuts.newStory');
  const pageTitle = t(`shortcuts.page.${route.name}`);

  const page: Entry[] = [];
  if (newLabel) page.push({ keys: [mod, 'N'], label: newLabel });
  if (onCards) {
    page.push(
      { keys: ['Enter'], label: t('shortcuts.openCard') },
      { keys: ['Space'], label: t('shortcuts.dragCard') },
      { keys: ['Shift', 'F10'], label: t('shortcuts.cardMenu') }
    );
  }
  const general: Entry[] = [
    { keys: [mod, 'F'], label: t('shortcuts.search') },
    { keys: [mod, '/'], label: t('shortcuts.overview') },
    { keys: ['?'], label: t('shortcuts.help') },
    { keys: ['Esc'], label: t('shortcuts.close') },
    { keys: [mod, 'Enter'], label: t('shortcuts.save') },
    { keys: [mod, 'Shift', 'Enter'], label: t('shortcuts.addAnother') }
  ];

  return (
    <Dialog title={t('shortcuts.title')} onClose={onClose}>
      <div className="shortcuts">
        {page.length > 0 && <Group title={pageTitle} entries={page} />}
        <Group title={t('shortcuts.everywhere')} entries={general} />
        <p className="muted">{t('shortcuts.note')}</p>
      </div>
      <div className="form__actions dialog__footer">
        <button type="button" className="btn dialog__footer-end" onClick={onClose}>
          {t('detail.close')}
        </button>
      </div>
    </Dialog>
  );
}
