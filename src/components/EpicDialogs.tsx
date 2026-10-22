import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { nextColorKey } from '../domain/epics';
import { EPIC_COLOR_KEYS, type EpicColorKey } from '../domain/types';
import { useApp } from '../state/AppState';
import { useCreateFields } from './CreateFields';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';
import { useBuiltin } from './useBuiltin';
import { CheckInput, TextInput } from '../ui';

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
          <CheckInput
            kind="radio"
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
  // A missing name is reported in the app's own words under the field, not by the browser.
  const [nameMissing, setNameMissing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const builtin = useBuiltin();

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!name.trim()) {
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    const values = custom.collect();
    if (!values) return;
    const id = app.createEpic({ name, colorKey, values });
    if (!id) return;
    onCreated?.(id);
    onClose();
  };

  return (
    <Dialog title={t('epics.new')} dirty={Boolean(name.trim())} submitShortcut onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${uid}-name`}>{builtin.label('title', t('epics.name'))}</label>
          <TextInput
            id={`${uid}-name`}
           
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameMissing(false);
            }}
            ref={nameRef}
            aria-required="true"
            aria-invalid={nameMissing || undefined}
            aria-describedby={nameMissing ? `${uid}-name-problem` : undefined}
            autoFocus
          />
          {nameMissing && (
            <p id={`${uid}-name-problem`} role="alert" className="field-error">
              {t('epics.problem.name')}
            </p>
          )}
        </div>
        {builtin.shown('epic', 'color') && (
          <div className="field">
            <span aria-hidden="true">{builtin.label('color', t('epics.colorLabel'))}</span>
            <ColorPicker
              name={`${uid}-color`}
              legend={builtin.label('color', t('epics.colorLabel'))}
              value={colorKey}
              onChange={setColorKey}
            />
          </div>
        )}
        {custom.fields}
        <DialogFooter submit={t('epics.add')} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
