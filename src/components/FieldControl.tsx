import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { parseValue } from '../domain/fields';
import type { FieldDefinition, FieldValue } from '../domain/types';
import { EditableText } from './EditableText';
import { fieldLabel } from './fieldLabel';

type Problem = 'invalidNumber' | 'required';

interface Props {
  field: FieldDefinition;
  value: FieldValue | undefined;
  /** Null clears the value. */
  onChange: (value: FieldValue | null) => void;
  /** A required field cannot be cleared and is marked while it has no value. */
  required?: boolean;
  /** "form" uses plain inputs for a create dialog; "inline" edits text in place like the story title. */
  mode?: 'inline' | 'form';
  /** In a form, marks an empty required field only after a save was tried. */
  flagMissing?: boolean;
}

interface NumberInputProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  value: number | undefined;
  /** Saves the entry; returns the problem when it was refused. */
  onSave: (raw: string) => Problem | null;
}

/** Number input that saves on Enter or when it loses focus. A refused entry stays so it can be corrected. */
function NumberInput({ id, describedBy, invalid, value, onSave }: NumberInputProps) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
  }, [value]);

  const save = (): void => {
    if (draft.trim() === (value === undefined ? '' : String(value)) && !invalid) return;
    onSave(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    }
  };

  return (
    <input
      id={id}
      className="input"
      inputMode="decimal"
      value={draft}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={onKeyDown}
    />
  );
}

/** Shows and edits the value of one custom field, by data type. */
export function FieldControl({ field, value, onChange, required = false, mode = 'inline', flagMissing = false }: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const label = fieldLabel(t, field);
  const [problem, setProblem] = useState<Problem | null>(null);
  const missing = required && value === undefined && (mode === 'inline' || flagMissing);
  const inputId = `${uid}-input`;
  const noteId = `${uid}-note`;

  /** Saves a parsed value, unless it would clear a required field. */
  const apply = (next: FieldValue | null): Problem | null => {
    if (next === null && required) {
      setProblem('required');
      return 'required';
    }
    setProblem(null);
    onChange(next);
    return null;
  };

  const note = problem ? (
    <span id={noteId} className="field__error" role="alert">
      {t(problem === 'required' ? 'fields.requiredError' : 'fields.invalidNumber')}
    </span>
  ) : missing ? (
    <span id={noteId} className="field__error">
      {t('fields.requiredMissing')}
    </span>
  ) : null;
  const describedBy = note ? noteId : undefined;
  const heading = (
    <>
      {label}
      {required && <span className="field__required"> {t('fields.requiredMark')}</span>}
    </>
  );

  switch (field.dataType) {
    case 'text':
    case 'long_text': {
      const text = value === undefined ? '' : String(value);
      if (mode === 'form') {
        const Tag = field.dataType === 'long_text' ? 'textarea' : 'input';
        return (
          <div className="field">
            <label htmlFor={inputId}>{heading}</label>
            <Tag
              id={inputId}
              className="input"
              rows={field.dataType === 'long_text' ? 3 : undefined}
              value={text}
              aria-invalid={missing || problem ? true : undefined}
              aria-describedby={describedBy}
              onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
            />
            {note}
          </div>
        );
      }
      return (
        <div className="field">
          <span className="field__label">{heading}</span>
          <EditableText
            value={text}
            label={label}
            multiline={field.dataType === 'long_text'}
            placeholder={t('fields.noValue')}
            onSave={(raw) => apply(parseValue(field, raw))}
          />
          {note}
        </div>
      );
    }
    case 'number':
      return (
        <div className="field">
          <label htmlFor={inputId}>{heading}</label>
          <NumberInput
            id={inputId}
            describedBy={describedBy}
            invalid={missing || problem !== null}
            value={typeof value === 'number' ? value : undefined}
            onSave={(raw) => {
              const parsed = parseValue(field, raw);
              if (parsed === null && raw.trim() !== '') {
                setProblem('invalidNumber');
                return 'invalidNumber';
              }
              return apply(parsed);
            }}
          />
          {note}
        </div>
      );
    case 'single_select':
      return (
        <div className="field">
          <label htmlFor={inputId}>{heading}</label>
          <select
            id={inputId}
            className="select"
            value={value === undefined ? '' : String(value)}
            aria-invalid={missing || problem ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => apply(parseValue(field, event.target.value))}
          >
            <option value="">{t('fields.noValue')}</option>
            {field.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {note}
        </div>
      );
    default:
      return null;
  }
}
