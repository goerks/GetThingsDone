import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../components/Dialog';
import { fieldLabel } from '../components/fieldLabel';
import { PencilIcon, TrashIcon } from '../components/icons';
import { assignedTypes, countValues, validateField, type FieldError, type FieldInput } from '../domain/fields';
import {
  CUSTOM_DATA_TYPES,
  EPIC_COLOR_KEYS,
  type CustomDataType,
  type EpicColorKey,
  type FieldDefinition,
  type ItemType
} from '../domain/types';
import { useApp } from '../state/AppState';

/** Item types that already show custom fields. */
const FIELD_ITEM_TYPES: readonly ItemType[] = ['story'];

interface OptionDraft {
  /** Stable React key, also for options that are not saved yet. */
  key: string;
  id?: string;
  label: string;
  colorKey: EpicColorKey;
}

let draftCounter = 0;
function draftKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

function emptyOption(index: number): OptionDraft {
  return { key: draftKey(), label: '', colorKey: EPIC_COLOR_KEYS[index % EPIC_COLOR_KEYS.length] };
}

interface FieldDialogProps {
  /** The field to edit, or undefined for a new one. */
  field?: FieldDefinition;
  onClose: () => void;
}

function FieldDialog({ field, onClose }: FieldDialogProps) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [label, setLabel] = useState(field?.label ?? '');
  const [dataType, setDataType] = useState<CustomDataType>((field?.dataType as CustomDataType | undefined) ?? 'text');
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    field && field.options.length > 0
      ? field.options.map((option) => ({ key: option.id, id: option.id, label: option.label, colorKey: option.colorKey }))
      : [emptyOption(0)]
  );
  const [itemTypes, setItemTypes] = useState<ItemType[]>(() => (field ? assignedTypes(app.assignments, field.id) : ['story']));
  const [error, setError] = useState<FieldError | null>(null);

  const changeOption = (key: string, patch: Partial<OptionDraft>): void =>
    setOptions((list) => list.map((option) => (option.key === key ? { ...option, ...patch } : option)));

  const toggleType = (itemType: ItemType, checked: boolean): void =>
    setItemTypes((list) => (checked ? [...list, itemType] : list.filter((item) => item !== itemType)));

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const input: FieldInput = {
      label,
      dataType,
      options: options.map(({ id, label: optionLabel, colorKey }) => ({ id, label: optionLabel, colorKey })),
      itemTypes
    };
    const problem = validateField(app.fields, input, field?.id ?? null);
    setError(problem);
    if (problem) return;
    const saved = field ? app.updateField(field.id, input) : app.createField(input) !== null;
    if (saved) onClose();
  };

  return (
    <Dialog title={field ? t('fields.dialogEdit') : t('fields.dialogNew')} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${uid}-label`}>{t('fields.label')}</label>
          <input
            id={`${uid}-label`}
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-type`}>{t('fields.dataType')}</label>
          <select
            id={`${uid}-type`}
            className="select"
            value={dataType}
            disabled={field !== undefined}
            aria-describedby={field ? `${uid}-type-locked` : undefined}
            onChange={(event) => setDataType(event.target.value as CustomDataType)}
          >
            {CUSTOM_DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`fields.type.${type}`)}
              </option>
            ))}
          </select>
          {field && (
            <span id={`${uid}-type-locked`} className="muted">
              {t('fields.typeLocked')}
            </span>
          )}
        </div>
        {dataType === 'single_select' && (
          <fieldset className="field option-list">
            <legend>{t('fields.options')}</legend>
            <ol className="option-list__items">
              {options.map((option, index) => (
                <li key={option.key} className="option-row">
                  <span className="epic__dot option-row__dot" style={{ background: `var(--epic-${option.colorKey})` }} aria-hidden="true" />
                  <input
                    className="input option-row__label"
                    aria-label={t('fields.option', { position: index + 1 })}
                    value={option.label}
                    onChange={(event) => changeOption(option.key, { label: event.target.value })}
                    autoFocus={option.id === undefined && index > 0}
                  />
                  <select
                    className="select"
                    aria-label={t('fields.optionColor', { position: index + 1 })}
                    value={option.colorKey}
                    onChange={(event) => changeOption(option.key, { colorKey: event.target.value as EpicColorKey })}
                  >
                    {EPIC_COLOR_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`epics.color.${key}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn icon-btn--quiet"
                    aria-label={t('fields.removeOption', { position: index + 1 })}
                    title={t('fields.removeOption', { position: index + 1 })}
                    disabled={options.length === 1}
                    onClick={() => setOptions((list) => list.filter((item) => item.key !== option.key))}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ol>
            <div>
              <button type="button" className="btn" onClick={() => setOptions((list) => [...list, emptyOption(list.length)])}>
                {t('fields.addOption')}
              </button>
            </div>
          </fieldset>
        )}
        <fieldset className="field">
          <legend>{t('fields.usedOn')}</legend>
          {FIELD_ITEM_TYPES.map((itemType) => (
            <label key={itemType} className="check">
              <input
                type="checkbox"
                checked={itemTypes.includes(itemType)}
                onChange={(event) => toggleType(itemType, event.target.checked)}
              />
              {t(`fields.itemType.${itemType}`)}
            </label>
          ))}
        </fieldset>
        {error && (
          <div role="alert" className="notice notice--error">
            {t(`fields.error.${error}`)}
          </div>
        )}
        <div className="form__actions">
          <button type="submit" className="btn btn--primary">
            {field ? t('fields.save') : t('fields.create')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('fields.cancel')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteFieldDialog({ field, onClose }: { field: FieldDefinition; onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const name = fieldLabel(t, field);
  const count = countValues(app.stories, field.id);

  return (
    <Dialog title={t('fields.delete', { name })} onClose={onClose}>
      <p>{t('fields.deleteConfirm', { name, count })}</p>
      <div className="form__actions">
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            app.deleteField(field.id);
            onClose();
          }}
        >
          {t('fields.deleteYes')}
        </button>
        <button type="button" className="btn" onClick={onClose} autoFocus>
          {t('fields.deleteNo')}
        </button>
      </div>
    </Dialog>
  );
}

type Open = { kind: 'new' } | { kind: 'edit'; field: FieldDefinition } | { kind: 'delete'; field: FieldDefinition } | null;

/** The fields section of the settings page. */
export function FieldsSection() {
  const { t } = useTranslation();
  const app = useApp();
  const [open, setOpen] = useState<Open>(null);
  const close = (): void => setOpen(null);

  return (
    <>
      <div className="page-head page-head--section">
        <h2>{t('fields.title')}</h2>
        <span className="muted">{t('fields.hint')}</span>
        <button type="button" className="btn btn--primary page-head__action" onClick={() => setOpen({ kind: 'new' })}>
          {t('fields.new')}
        </button>
      </div>
      {open?.kind === 'new' && <FieldDialog onClose={close} />}
      {open?.kind === 'edit' && <FieldDialog field={open.field} onClose={close} />}
      {open?.kind === 'delete' && <DeleteFieldDialog field={open.field} onClose={close} />}
      <div className="fields">
        <table className="field-table">
          <thead>
            <tr>
              <th scope="col">{t('fields.column.name')}</th>
              <th scope="col">{t('fields.column.kind')}</th>
              <th scope="col">{t('fields.column.type')}</th>
              <th scope="col">{t('fields.column.usedOn')}</th>
              <td />
            </tr>
          </thead>
          <tbody>
            {app.fields.map((field) => {
              const name = fieldLabel(t, field);
              const types = assignedTypes(app.assignments, field.id);
              return (
                <tr key={field.id}>
                  <th scope="row" className="field-table__name">
                    {name}
                  </th>
                  <td>
                    <span className={`badge badge--${field.kind}`}>{t(`fields.kind.${field.kind}`)}</span>
                  </td>
                  <td>{t(`fields.type.${field.dataType}`)}</td>
                  <td>
                    {types.length > 0 ? (
                      types.map((type) => t(`fields.itemType.${type}`)).join(', ')
                    ) : (
                      <span className="muted">{t('fields.notUsed')}</span>
                    )}
                  </td>
                  <td className="field-table__actions">
                    {field.kind === 'custom' && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--quiet"
                        aria-label={t('fields.edit', { name })}
                        title={t('fields.edit', { name })}
                        onClick={() => setOpen({ kind: 'edit', field })}
                      >
                        <PencilIcon />
                      </button>
                    )}
                    {field.kind === 'custom' && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--quiet"
                        aria-label={t('fields.delete', { name })}
                        title={t('fields.delete', { name })}
                        onClick={() => setOpen({ kind: 'delete', field })}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
