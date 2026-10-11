import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditableText } from '../components/EditableText';
import { ColorPicker, NewEpicDialog } from '../components/EpicDialogs';
import { TrashIcon } from '../components/icons';
import { sortEpics, storiesInEpic } from '../domain/epics';
import type { Epic } from '../domain/types';
import { useApp } from '../state/AppState';

/** The colour dot of an epic. A click opens the palette; picking a colour, Escape or a click outside closes it. */
function ColorButton({ epic }: { epic: Epic }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      ref={wrapper}
      className="color-button"
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="color-button__trigger"
        aria-label={t('epics.changeColor', { name: epic.name, color: t(`epics.color.${epic.colorKey}`) })}
        aria-expanded={open}
        aria-controls={open ? `${uid}-palette` : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="color-button__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
      </button>
      {open && (
        <div id={`${uid}-palette`} className="color-button__palette">
          <ColorPicker
            name={`${uid}-color`}
            legend={t('epics.colorOf', { name: epic.name })}
            value={epic.colorKey}
            autoFocus
            onChange={(colorKey) => {
              app.updateEpic(epic.id, { colorKey });
              close();
            }}
          />
        </div>
      )}
    </div>
  );
}

function EpicRow({ epic }: { epic: Epic }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const count = storiesInEpic(app.stories, epic.id);

  return (
    <li className="epic-row">
      <ColorButton epic={epic} />
      <div className="epic-row__name">
        <EditableText
          value={epic.name}
          label={t('epics.name')}
          required
          onSave={(name) => app.updateEpic(epic.id, { name })}
        />
      </div>
      <span className="muted epic-row__count">{t('epics.storyCount', { count })}</span>
      <button
        type="button"
        className="icon-btn icon-btn--quiet"
        aria-label={t('epics.delete', { name: epic.name })}
        title={count > 0 ? t('epics.inUse', { count }) : t('epics.delete', { name: epic.name })}
        disabled={count > 0}
        aria-describedby={count > 0 ? `${uid}-in-use` : undefined}
        onClick={() => app.deleteEpic(epic.id)}
      >
        <TrashIcon />
      </button>
      {count > 0 && (
        <span id={`${uid}-in-use`} className="sr-only">
          {t('epics.inUse', { count })}
        </span>
      )}
    </li>
  );
}

export function EpicsPage() {
  const { t } = useTranslation();
  const app = useApp();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="page-head">
        <h1>{t('epics.title')}</h1>
        <span className="muted">{t('epics.hint')}</span>
        <button type="button" className="btn btn--primary page-head__action" onClick={() => setCreating(true)}>
          {t('epics.new')}
        </button>
      </div>
      {creating && <NewEpicDialog onClose={() => setCreating(false)} />}
      <div className="epics">
        {app.epics.length === 0 ? (
          <p className="muted">{t('epics.none')}</p>
        ) : (
          <ul className="epic-list">
            {sortEpics(app.epics).map((epic) => (
              <EpicRow key={epic.id} epic={epic} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
