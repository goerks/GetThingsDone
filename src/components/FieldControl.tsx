import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { parseValue } from '../domain/fields';
import type { FieldDefinition, FieldValue } from '../domain/types';
import { EditableText } from './EditableText';
import { fieldLabel } from './fieldLabel';

interface Props {
  field: FieldDefinition;
  value: FieldValue | undefined;
  /** Null clears the value. */
  onChange: (value: FieldValue | null) => void;
}

interface NumberInputProps {
  id: string;
  errorId: string;
  value: number | undefined;
  /** Returns false when the entry is not a number. */
  onChange: (raw: string) => boolean;
}

/** Number input that saves on Enter or when it loses focus, and keeps an invalid entry with a hint. */
function NumberInput({ id, errorId, value, onChange }: NumberInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
    setInvalid(false);
  }, [value]);

  const save = (): void => {
    if (draft.trim() === (value === undefined ? '' : String(value))) return;
    setInvalid(!onChange(draft));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    }
  };

  return (
    <>
      <input
        id={id}
        className="input"
        inputMode="decimal"
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
      />
      {invalid && (
        <span id={errorId} className="field__error" role="alert">
          {t('fields.invalidNumber')}
        </span>
      )}
    </>
  );
}

/** Shows and edits the value of one custom field, by data type. */
export function FieldControl({ field, value, onChange }: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const label = fieldLabel(t, field);

  switch (field.dataType) {
    case 'text':
    case 'long_text':
      return (
        <div className="field">
          <span className="field__label">{label}</span>
          <EditableText
            value={value === undefined ? '' : String(value)}
            label={label}
            multiline={field.dataType === 'long_text'}
            placeholder={t('fields.noValue')}
            onSave={(text) => onChange(parseValue(field, text))}
          />
        </div>
      );
    case 'number':
      return (
        <div className="field">
          <label htmlFor={`${uid}-input`}>{label}</label>
          <NumberInput
            id={`${uid}-input`}
            errorId={`${uid}-error`}
            value={typeof value === 'number' ? value : undefined}
            onChange={(raw) => {
              const parsed = parseValue(field, raw);
              if (parsed === null && raw.trim() !== '') return false;
              onChange(parsed);
              return true;
            }}
          />
        </div>
      );
    case 'single_select':
      return (
        <div className="field">
          <label htmlFor={`${uid}-input`}>{label}</label>
          <select
            id={`${uid}-input`}
            className="select"
            value={value === undefined ? '' : String(value)}
            onChange={(event) => onChange(parseValue(field, event.target.value))}
          >
            <option value="">{t('fields.noValue')}</option>
            {field.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    default:
      return null;
  }
}
