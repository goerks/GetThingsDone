import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../components/Dialog';
import { EditableText } from '../components/EditableText';
import { TrashIcon } from '../components/icons';
import { nextColorKey, storiesInEpic } from '../domain/epics';
import { EPIC_COLOR_KEYS, type Epic, type EpicColorKey } from '../domain/types';
import { useApp } from '../state/AppState';

interface ColorPickerProps {
  name: string;
  legend: string;
  value: EpicColorKey;
  onChange: (key: EpicColorKey) => void;
  autoFocus?: boolean;
}

/** Colour swatches as a radio group, so arrow keys move between colours. Each colour has a written name. */
function ColorPicker({ name, legend, value, onChange, autoFocus = false }: ColorPickerProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="swatches">
      <legend className="sr-only">{legend}</legend>
      {EPIC_COLOR_KEYS.map((key) => (
        <label key={key} className="swatch" title={t(`epics.color.${key}`)}>
          <input
            type="radio"
            name={name}
            value={key}
            checked={value === key}
            onChange={() => onChange(key)}
            autoFocus={autoFocus && value === key}
          />
          <span className="swatch__dot" style={{ background: `var(--epic-${key})` }} aria-hidden="true" />
          <span className="sr-only">{t(`epics.color.${key}`)}</span>
        </label>
      ))}
    </fieldset>
  );
}

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

function NewEpicDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<EpicColorKey>(() => nextColorKey(app.epics));

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (app.createEpic({ name, colorKey })) onClose();
  };

  return (
    <Dialog title={t('epics.new')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor={`${uid}-name`}>{t('epics.name')}</label>
          <input
            id={`${uid}-name`}
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <span aria-hidden="true">{t('epics.colorLabel')}</span>
          <ColorPicker name={`${uid}-color`} legend={t('epics.colorLabel')} value={colorKey} onChange={setColorKey} />
        </div>
        <div className="form__actions">
          <button type="submit" className="btn btn--primary">
            {t('epics.add')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('newStory.cancel')}
          </button>
        </div>
      </form>
    </Dialog>
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
            {app.epics.map((epic) => (
              <EpicRow key={epic.id} epic={epic} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
