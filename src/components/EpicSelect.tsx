import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { sortEpics } from '../domain/epics';
import { useApp } from '../state/AppState';

const NEW_EPIC = '__new__';

interface Props {
  id: string;
  value: string | null;
  onChange: (epicId: string | null) => void;
}

/** Epic dropdown with "No epic" and a "New epic" entry that creates an epic in place. */
export function EpicSelect({ id, value, onChange }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = (event?: FormEvent): void => {
    event?.preventDefault();
    const epicId = app.createEpic({ name });
    if (!epicId) return;
    onChange(epicId);
    setCreating(false);
    setName('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // The select may sit inside another form, so Enter is handled here instead of submitting that form.
    if (event.key === 'Enter') {
      event.preventDefault();
      create();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCreating(false);
    }
  };

  return (
    <div className="epic-select">
      <select
        id={id}
        className="select"
        value={creating ? NEW_EPIC : (value ?? '')}
        onChange={(event) => {
          if (event.target.value === NEW_EPIC) setCreating(true);
          else {
            setCreating(false);
            onChange(event.target.value || null);
          }
        }}
      >
        <option value="">{t('epics.noEpic')}</option>
        {sortEpics(app.epics).map((epic) => (
          <option key={epic.id} value={epic.id}>
            {epic.name}
          </option>
        ))}
        <option value={NEW_EPIC}>{t('epics.newInSelect')}</option>
      </select>
      {creating && (
        <div className="epic-select__new">
          <input
            className="input"
            aria-label={t('epics.name')}
            placeholder={t('epics.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
          />
          <button type="button" className="btn" onClick={() => create()}>
            {t('epics.add')}
          </button>
        </div>
      )}
    </div>
  );
}
