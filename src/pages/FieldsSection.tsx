import { featureOn } from '../domain/settings';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../components/Dialog';
import { fieldLabel } from '../components/fieldLabel';
import { LockIcon, PencilIcon, TrashIcon } from '../components/icons';
import {
  BUILTIN_FIELDS,
  CONVERSIONS,
  canHide,
  canRename,
  countValues,
  defaultAsText,
  hasOptions,
  validateField,
  type FieldError,
  type FieldInput
} from '../domain/fields';
import {
  CUSTOM_DATA_TYPES,
  EPIC_COLOR_KEYS,
  type CustomDataType,
  type EpicColorKey,
  type FieldDefinition,
  type FieldKind,
  type ItemType
} from '../domain/types';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';
import { FieldLayout } from './FieldLayout';
import { Button, IconButton, Select, TextInput } from '../ui';

/** Item types that show custom fields, one column each in the field table. */
const FIELD_ITEM_TYPES: readonly ItemType[] = ['story', 'epic', 'release'];

/** Item types a custom field can be used on. Releases carry built-in fields only until custom fields on releases follow (#9). */
const CUSTOM_ITEM_TYPES: readonly ItemType[] = ['story', 'epic'];

/** Item types that get fields later; shown as planned columns. */
const PLANNED_ITEM_TYPES = ['sprint'] as const;

const KIND_ORDER: readonly FieldKind[] = ['system', 'builtin', 'custom'];

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
  // Only a new field picks its item types here; later they are switched in the field table.
  const [itemTypes, setItemTypes] = useState<ItemType[]>(['story']);
  // Text and number defaults as typed; a select default follows its option even when the option is renamed.
  const [defaultText, setDefaultText] = useState(() => (field && !hasOptions(field.dataType) ? defaultAsText(field) : ''));
  const [defaultOptions, setDefaultOptions] = useState<string[]>(() => {
    if (!field || !hasOptions(field.dataType) || field.defaultValue === null) return [];
    return Array.isArray(field.defaultValue) ? field.defaultValue : [String(field.defaultValue)];
  });
  const [error, setError] = useState<FieldError | null>(null);
  const namedOptions = options.filter((option) => option.label.trim());
  const defaultValue = hasOptions(dataType)
    ? namedOptions
        .filter((option) => defaultOptions.includes(option.key))
        .map((option) => option.label.trim())
        .slice(0, dataType === 'single_select' ? 1 : undefined)
        .join(', ')
    : defaultText;
  // An existing field offers only the type changes that keep every value.
  const typeChoices: readonly CustomDataType[] = field
    ? [field.dataType as CustomDataType, ...CONVERSIONS[field.dataType as CustomDataType]]
    : CUSTOM_DATA_TYPES;

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
      itemTypes,
      defaultValue
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
          <TextInput
            id={`${uid}-label`}
           
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-type`}>{t('fields.dataType')}</label>
          <Select
            id={`${uid}-type`}
           
            value={dataType}
            disabled={typeChoices.length === 1}
            aria-describedby={field ? `${uid}-type-locked` : undefined}
            onChange={(event) => {
              setDataType(event.target.value as CustomDataType);
              // A new field starts its default over; an existing one keeps it, since conversions keep values.
              if (!field) {
                setDefaultText('');
                setDefaultOptions([]);
              }
            }}
          >
            {typeChoices.map((type) => (
              <option key={type} value={type}>
                {t(`fields.type.${type}`)}
              </option>
            ))}
          </Select>
          {field && (
            <span id={`${uid}-type-locked`} className="muted">
              {typeChoices.length === 1 ? t('fields.typeLocked') : t('fields.typeConversions')}
            </span>
          )}
        </div>
        {hasOptions(dataType) && (
          <fieldset className="field option-list">
            <legend>{t('fields.options')}</legend>
            <ol className="option-list__items">
              {options.map((option, index) => (
                <li key={option.key} className="option-row">
                  <span className="epic__dot option-row__dot" style={{ background: `var(--epic-${option.colorKey})` }} aria-hidden="true" />
                  <TextInput
                    className="option-row__label"
                    aria-label={t('fields.option', { position: index + 1 })}
                    value={option.label}
                    onChange={(event) => changeOption(option.key, { label: event.target.value })}
                    autoFocus={option.id === undefined && index > 0}
                  />
                  <Select
                   
                    aria-label={t('fields.optionColor', { position: index + 1 })}
                    value={option.colorKey}
                    onChange={(event) => changeOption(option.key, { colorKey: event.target.value as EpicColorKey })}
                  >
                    {EPIC_COLOR_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`epics.color.${key}`)}
                      </option>
                    ))}
                  </Select>
                  <IconButton
                    type="button"
                    quiet
                    aria-label={t('fields.removeOption', { position: index + 1 })}
                    title={t('fields.removeOption', { position: index + 1 })}
                    disabled={options.length === 1}
                    onClick={() => setOptions((list) => list.filter((item) => item.key !== option.key))}
                  >
                    <TrashIcon />
                  </IconButton>
                </li>
              ))}
            </ol>
            <div>
              <Button type="button" onClick={() => setOptions((list) => [...list, emptyOption(list.length)])}>
                {t('fields.addOption')}
              </Button>
            </div>
          </fieldset>
        )}
        {dataType === 'multi_select' ? (
          <fieldset className="field field--choices">
            <legend>{t('fields.defaultValue')}</legend>
            {namedOptions.map((option) => (
              <label key={option.key} className="check">
                <input
                  type="checkbox"
                  checked={defaultOptions.includes(option.key)}
                  onChange={(event) =>
                    setDefaultOptions((list) => (event.target.checked ? [...list, option.key] : list.filter((key) => key !== option.key)))
                  }
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        ) : dataType === 'checkbox' ? (
          <label className="check">
            <input type="checkbox" checked={defaultText === 'true'} onChange={(event) => setDefaultText(event.target.checked ? 'true' : '')} />
            {t('fields.defaultTicked')}
          </label>
        ) : (
          <div className="field">
            <label htmlFor={`${uid}-default`}>{t('fields.defaultValue')}</label>
            {dataType === 'single_select' ? (
              <Select
                id={`${uid}-default`}
               
                value={namedOptions.find((option) => defaultOptions.includes(option.key))?.key ?? ''}
                onChange={(event) => setDefaultOptions(event.target.value ? [event.target.value] : [])}
              >
                <option value="">{t('fields.noDefault')}</option>
                {namedOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                id={`${uid}-default`}
               
                type={dataType === 'date' ? 'date' : 'text'}
                inputMode={dataType === 'number' ? 'decimal' : dataType === 'url' ? 'url' : undefined}
                placeholder={t('fields.noDefault')}
                value={defaultText}
                onChange={(event) => setDefaultText(event.target.value)}
              />
            )}
          </div>
        )}
        {!field && (
          <fieldset className="field">
            <legend>{t('fields.usedOn')}</legend>
            {CUSTOM_ITEM_TYPES.map((itemType) => (
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
        )}
        {error && (
          <div role="alert" className="notice notice--error">
            {t(`fields.error.${error}`)}
          </div>
        )}
        <div className="form__actions">
          <Button type="submit" variant="primary">
            {field ? t('fields.save') : t('fields.create')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('fields.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteFieldDialog({ field, onClose }: { field: FieldDefinition; onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const name = fieldLabel(t, field);
  const stories = countValues(app.stories, field.id);
  const epics = countValues(app.epics, field.id);

  return (
    <Dialog title={t('fields.delete', { name })} onClose={onClose}>
      <p>{t('fields.deleteQuestion', { name })}</p>
      {stories > 0 && <p>{t('fields.loseStories', { count: stories })}</p>}
      {epics > 0 && <p>{t('fields.loseEpics', { count: epics })}</p>}
      <div className="form__actions">
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            app.deleteField(field.id);
            onClose();
          }}
        >
          {t('fields.deleteYes')}
        </Button>
        <Button type="button" onClick={onClose} autoFocus>
          {t('fields.deleteNo')}
        </Button>
      </div>
    </Dialog>
  );
}

interface UseCellProps {
  field: FieldDefinition;
  itemType: ItemType;
  name: string;
}

/** One cell of the matrix: whether a field is used on an item type. */
function UseCell({ field, itemType, name }: UseCellProps) {
  const { t } = useTranslation();
  const app = useApp();
  const typeName = t(`fields.itemType.${itemType}`);
  const builtin = BUILTIN_FIELDS.find((item) => item.key === field.builtinKey);
  // Releases switched off: the release field and everything on releases is kept but not available.
  if (!featureOn(app.settings, 'releases') && (itemType === 'release' || field.builtinKey === 'release')) {
    const off = t('fields.releasesOffCell', { name, type: typeName });
    return (
      <td className="field-table__use">
        <span aria-hidden="true" title={off}>
          –
        </span>
        <span className="sr-only">{off}</span>
      </td>
    );
  }
  if (builtin && !builtin.itemTypes.includes(itemType)) {
    return (
      <td className="field-table__use">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{t('fields.notAvailable', { name, type: typeName })}</span>
      </td>
    );
  }
  const used = app.assignments.some((item) => item.fieldId === field.id && item.itemType === itemType && !item.hidden);
  const label = t('fields.useOn', { name, type: typeName });
  if (field.kind === 'custom' && !CUSTOM_ITEM_TYPES.includes(itemType)) {
    return (
      <td className="field-table__use">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{t('fields.customOnReleases', { type: typeName })}</span>
      </td>
    );
  }
  if (field.kind === 'builtin' && canHide(field, itemType)) {
    return (
      <td className="field-table__use">
        <input
          type="checkbox"
          checked={used}
          aria-label={label}
          onChange={(event) => app.setBuiltinFieldHidden(field.id, itemType, !event.target.checked)}
        />
      </td>
    );
  }
  if (field.kind !== 'custom') {
    const note = field.kind === 'system' ? t('fields.locked') : field.builtinKey === 'epic' ? t('fields.epicFixed') : t('fields.alwaysOn');
    return (
      <td className="field-table__use">
        <span className="field-table__fixed" title={note}>
          <input type="checkbox" checked={used} disabled aria-label={`${label}. ${note}`} readOnly />
          <LockIcon />
        </span>
      </td>
    );
  }
  return (
    <td className="field-table__use">
      <input type="checkbox" checked={used} aria-label={label} onChange={(event) => app.setFieldUsed(field.id, itemType, event.target.checked)} />
    </td>
  );
}

interface FieldRowProps {
  field: FieldDefinition;
  onEdit: () => void;
  onDelete: () => void;
  onRename: () => void;
}

function FieldRow({ field, onEdit, onDelete, onRename }: FieldRowProps) {
  const { t } = useTranslation();
  const name = fieldLabel(t, field);
  return (
    <tr>
      <th scope="row" className="field-table__name">
        {name}
      </th>
      <td>{t(`fields.type.${field.dataType}`)}</td>
      {FIELD_ITEM_TYPES.map((itemType) => (
        <UseCell key={itemType} field={field} itemType={itemType} name={name} />
      ))}
      {PLANNED_ITEM_TYPES.map((itemType) => (
        <td key={itemType} className="field-table__planned" />
      ))}
      <td className="field-table__actions">
        {field.kind !== 'custom' && canRename(field) && (
          <IconButton type="button" quiet aria-label={t('fields.rename', { name })} title={t('fields.rename', { name })} onClick={onRename}>
            <PencilIcon />
          </IconButton>
        )}
        {field.kind === 'custom' && (
          <>
            <IconButton type="button" quiet aria-label={t('fields.edit', { name })} title={t('fields.edit', { name })} onClick={onEdit}>
              <PencilIcon />
            </IconButton>
            <IconButton type="button" quiet aria-label={t('fields.delete', { name })} title={t('fields.delete', { name })} onClick={onDelete}>
              <TrashIcon />
            </IconButton>
          </>
        )}
      </td>
    </tr>
  );
}

type Open =
  | { kind: 'new' }
  | { kind: 'edit'; field: FieldDefinition }
  | { kind: 'delete'; field: FieldDefinition }
  | { kind: 'rename'; field: FieldDefinition }
  | null;

/** Renames a system or built-in field with one label for all languages, or brings back the translated default. */
function RenameFieldDialog({ field, onClose }: { field: FieldDefinition; onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const standard = fieldLabel(t, { ...field, label: null });
  const [label, setLabel] = useState(field.label ?? standard);

  const save = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = label.trim();
    app.renameBuiltinField(field.id, trimmed && trimmed !== standard ? trimmed : null);
    onClose();
  };

  return (
    <Dialog title={t('fields.renameTitle')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="field">
          <label htmlFor={`${uid}-label`}>{t('fields.label')}</label>
          <TextInput id={`${uid}-label`} value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
          <span className="muted">{t('fields.renameHint', { name: standard })}</span>
        </div>
        <div className="form__actions">
          <Button type="submit" variant="primary">
            {t('fields.save')}
          </Button>
          {field.label !== null && (
            <Button
              type="button"
             
              onClick={() => {
                app.renameBuiltinField(field.id, null);
                onClose();
              }}
            >
              {t('fields.resetLabel', { name: standard })}
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            {t('fields.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The fields section of the settings page. */
export function FieldsSection() {
  const { t } = useTranslation();
  const app = useApp();
  const [open, setOpen] = useState<Open>(null);
  const [view, setView] = useState<'assign' | 'layout'>('assign');
  const close = (): void => setOpen(null);

  return (
    <>
      <div className="page-head page-head--section">
        <h2>{t('fields.title')}</h2>
        <span className="muted">{t('fields.hint')}</span>
        <Button type="button" variant="primary" className="page-head__action" onClick={() => setOpen({ kind: 'new' })}>
          {t('fields.new')}
        </Button>
      </div>
      {open?.kind === 'new' && <FieldDialog onClose={close} />}
      {open?.kind === 'edit' && <FieldDialog field={open.field} onClose={close} />}
      {open?.kind === 'delete' && <DeleteFieldDialog field={open.field} onClose={close} />}
      {open?.kind === 'rename' && <RenameFieldDialog field={open.field} onClose={close} />}
      <div className="view-tabs" role="tablist" aria-label={t('fields.views')}>
        {(['assign', 'layout'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={view === item}
            className="view-tabs__tab"
            onClick={() => setView(item)}
          >
            {t(`fields.view.${item}`)}
          </button>
        ))}
      </div>
      {!featureOn(app.settings, 'releases') && (
        <p className="hint hint--info" role="note">
          {t('fields.layout.releaseOff')} · <a href={hrefs.settingsReleases}>{t('fields.layout.releaseOffLink')}</a>
        </p>
      )}
      {view === 'layout' ? (
        <FieldLayout />
      ) : (
        <div className="fields">
          <table className="field-table">
            <thead>
              <tr>
                <th scope="col">{t('fields.column.name')}</th>
                <th scope="col">{t('fields.column.type')}</th>
                {FIELD_ITEM_TYPES.map((itemType) => (
                  <th key={itemType} scope="col" className="field-table__type">
                    {t(`fields.itemType.${itemType}`)}
                  </th>
                ))}
                {PLANNED_ITEM_TYPES.map((itemType) => (
                  <th key={itemType} scope="col" className="field-table__type field-table__planned">
                    {t(`fields.itemType.${itemType}`)}
                    <small>{t('settings.planned')}</small>
                  </th>
                ))}
                <td />
              </tr>
            </thead>
            {KIND_ORDER.map((kind) => {
              const group = app.fields.filter((field) => field.kind === kind);
              if (group.length === 0) return null;
              return (
                <tbody key={kind}>
                  <tr className="field-table__group">
                    <th scope="colgroup" colSpan={3 + FIELD_ITEM_TYPES.length + PLANNED_ITEM_TYPES.length}>
                      {t(`fields.group.${kind}`)}
                    </th>
                  </tr>
                  {group.map((field) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      onEdit={() => setOpen({ kind: 'edit', field })}
                      onDelete={() => setOpen({ kind: 'delete', field })}
                      onRename={() => setOpen({ kind: 'rename', field })}
                    />
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </>
  );
}
