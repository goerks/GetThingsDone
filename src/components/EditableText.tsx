import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BareButton, BareInput, BareTextarea } from '../ui';

interface Props {
  value: string;
  /** Name of the field, used for the accessible label ("Edit title"). */
  label: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  /** Shown when the value is empty. */
  placeholder?: string;
  /** An empty value is not saved and restores the old one. */
  required?: boolean;
  className?: string;
}

/**
 * Text that turns into an input on click. Enter (Ctrl+Enter for several lines) or leaving the field saves,
 * Escape discards the change.
 */
export function EditableText({ value, label, onSave, multiline = false, placeholder, required = false, className }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  const start = (): void => {
    setDraft(value);
    setEditing(true);
  };

  const finish = (save: boolean, focusButton: boolean): void => {
    if (!editing) return;
    returnFocus.current = focusButton;
    setEditing(false);
    const next = draft.trim();
    if (!save || next === value.trim() || (required && !next)) return;
    onSave(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(false, true);
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      finish(true, true);
    }
  };

  if (editing) {
    const common = {
      className: `input editable__input${className ? ` ${className}` : ''}`,
      value: draft,
      'aria-label': label,
      autoFocus: true,
      onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
      onBlur: () => finish(true, false),
      onKeyDown
    };
    return multiline ? <BareTextarea rows={5} {...common} /> : <BareInput {...common} />;
  }

  return (
    <BareButton
      ref={buttonRef}
      type="button"
      className={`editable${className ? ` ${className}` : ''}${value ? '' : ' editable--empty'}`}
      onClick={start}
    >
      {value || placeholder}
      <span className="sr-only"> – {t('edit.action', { field: label })}</span>
    </BareButton>
  );
}
