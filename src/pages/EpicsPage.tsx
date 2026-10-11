import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
}

/** Colour swatches as a radio group, so arrow keys move between colours. Each colour has a written name. */
function ColorPicker({ name, legend, value, onChange }: ColorPickerProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="swatches">
      <legend className="sr-only">{legend}</legend>
      {EPIC_COLOR_KEYS.map((key) => (
        <label key={key} className="swatch" title={t(`epics.color.${key}`)}>
          <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} />
          <span className="swatch__dot" style={{ background: `var(--epic-${key})` }} aria-hidden="true" />
          <span className="sr-only">{t(`epics.color.${key}`)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function EpicRow({ epic }: { epic: Epic }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const count = storiesInEpic(app.stories, epic.id);

  return (
    <li className="epic-row">
      <span className="epic__dot epic-row__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
      <div className="epic-row__name">
        <EditableText
          value={epic.name}
          label={t('epics.name')}
          required
          onSave={(name) => app.updateEpic(epic.id, { name })}
        />
      </div>
      <ColorPicker
        name={`${uid}-color`}
        legend={t('epics.colorOf', { name: epic.name })}
        value={epic.colorKey}
        onChange={(colorKey) => app.updateEpic(epic.id, { colorKey })}
      />
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
  const uid = useId();
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<EpicColorKey>(() => nextColorKey(app.epics));

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const id = app.createEpic({ name, colorKey });
    if (!id) return;
    setName('');
    setColorKey(nextColorKey([...app.epics, { id, name, colorKey }]));
  };

  return (
    <>
      <div className="page-head">
        <h1>{t('epics.title')}</h1>
        <span className="muted">{t('epics.hint')}</span>
      </div>
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

        <form className="panel form" onSubmit={submit}>
          <h2>{t('epics.new')}</h2>
          <div className="field">
            <label htmlFor={`${uid}-name`}>{t('epics.name')}</label>
            <input id={`${uid}-name`} className="input" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="field">
            <span aria-hidden="true">{t('epics.colorLabel')}</span>
            <ColorPicker name={`${uid}-new-color`} legend={t('epics.colorLabel')} value={colorKey} onChange={setColorKey} />
          </div>
          <div className="form__actions">
            <button type="submit" className="btn btn--primary">
              {t('epics.add')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
