import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { nextColorKey } from '../domain/epics';
import { EPIC_COLOR_KEYS, type EpicColorKey } from '../domain/types';
import { useApp } from '../state/AppState';
import { useCreateFields } from './CreateFields';
import { Dialog } from './Dialog';

interface ColorPickerProps {
  name: string;
  legend: string;
  value: EpicColorKey;
  onChange: (key: EpicColorKey) => void;
  autoFocus?: boolean;
}

/** Colour swatches as a radio group, so arrow keys move between colours. Each colour has a written name. */
export function ColorPicker({ name, legend, value, onChange, autoFocus = false }: ColorPickerProps) {
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

/** Dialog for a new epic. `onCreated` receives the id of the new epic. */
export function NewEpicDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState<EpicColorKey>(() => nextColorKey(app.epics));
  const custom = useCreateFields('epic');

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!name.trim()) return;
    const values = custom.collect();
    if (!values) return;
    const id = app.createEpic({ name, colorKey, values });
    if (!id) return;
    onCreated?.(id);
    onClose();
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
        {custom.fields}
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
