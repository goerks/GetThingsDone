import type { TFunction } from 'i18next';
import type { FieldDefinition } from '../domain/types';

/** The label a field shows: the team's own label, or the translated default of a system or built-in field. */
export function fieldLabel(t: TFunction, field: FieldDefinition): string {
  if (field.label) return field.label;
  return field.builtinKey ? t(`fields.builtin.${field.builtinKey}`) : '';
}
