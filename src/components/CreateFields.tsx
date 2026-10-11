import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createFieldsFor, defaultValuesFor, missingRequired, parseValue } from '../domain/fields';
import type { FieldDefinition, FieldValue, ItemType } from '../domain/types';
import { useApp } from '../state/AppState';
import { FieldControl } from './FieldControl';
import { fieldLabel } from './fieldLabel';

interface CreateFields {
  /** The inputs of the custom fields for the create dialog, with a message for missing required fields. */
  fields: ReactNode;
  /** The values to store, or null when a required field is empty (the message is shown). */
  collect: () => Record<string, FieldValue> | null;
}

/**
 * Custom fields of a create dialog: the fields chosen for the dialog and every required one,
 * prefilled with the defaults of all custom fields of the item type.
 */
export function useCreateFields(itemType: ItemType): CreateFields {
  const { t } = useTranslation();
  const app = useApp();
  const entries = createFieldsFor(itemType, app.fields, app.assignments);
  const [values, setValues] = useState<Record<string, FieldValue>>(() => defaultValuesFor(itemType, app.fields, app.assignments));
  const [missing, setMissing] = useState<FieldDefinition[]>([]);

  const change = (fieldId: string, value: FieldValue | null): void =>
    setValues((current) => {
      const next = { ...current };
      if (value === null) delete next[fieldId];
      else next[fieldId] = value;
      return next;
    });

  const collect = (): Record<string, FieldValue> | null => {
    const clean: Record<string, FieldValue> = {};
    for (const [fieldId, value] of Object.entries(values)) {
      const field = app.fields.find((item) => item.id === fieldId);
      if (!field) continue;
      const parsed = typeof value === 'string' ? parseValue(field, value) : value;
      if (parsed !== null) clean[fieldId] = parsed;
    }
    const gaps = missingRequired(itemType, app.fields, app.assignments, clean);
    setMissing(gaps);
    return gaps.length > 0 ? null : clean;
  };

  const fields = (
    <>
      {entries.map(({ field, assignment }) => (
        <FieldControl
          key={field.id}
          field={field}
          mode="form"
          required={assignment.required}
          flagMissing={missing.some((item) => item.id === field.id)}
          value={values[field.id]}
          onChange={(value) => change(field.id, value)}
        />
      ))}
      {missing.length > 0 && (
        <div role="alert" className="notice notice--error">
          {t('fields.fillRequired', { names: missing.map((field) => fieldLabel(t, field)).join(', ') })}
        </div>
      )}
    </>
  );

  return { fields, collect };
}
