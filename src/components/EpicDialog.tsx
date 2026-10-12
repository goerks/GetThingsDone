import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { storiesInEpic } from '../domain/epics';
import { customFieldsFor, isRequired } from '../domain/fields';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { EditableText } from './EditableText';
import { FieldControl } from './FieldControl';
import { ColorPicker } from './EpicDialogs';
import { useBuiltin } from './useBuiltin';

/** Details of an epic in a dialog: name and colour are saved at once; an epic without stories can be deleted. */
export function EpicDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const epic = app.epics.find((item) => item.id === id);

  if (!epic) {
    return (
      <Dialog title={t('epics.notFound')} onClose={onClose}>
        <div className="form__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('detail.close')}
          </button>
        </div>
      </Dialog>
    );
  }

  const count = storiesInEpic(app.stories, epic.id);
  const colorShown = builtin.shown('epic', 'color');
  const customFields = customFieldsFor('epic', app.fields, app.assignments);
  const remove = (): void => {
    if (app.deleteEpic(epic.id)) onClose();
  };

  return (
    <Dialog label={epic.name} onClose={onClose}>
      <div className="form">
        <div className="epic-dialog__name">
          {colorShown && (
            <span className="epic__dot epic-dialog__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
          )}
          <h2 className="dialog__title epic-dialog__title">
            <EditableText
              value={epic.name}
              label={builtin.label('title', t('epics.name'))}
              required
              onSave={(name) => app.updateEpic(epic.id, { name })}
            />
          </h2>
        </div>
        {colorShown && (
          <div className="field">
            <span aria-hidden="true">{builtin.label('color', t('epics.colorLabel'))}</span>
            <ColorPicker
              name={`${uid}-color`}
              legend={t('epics.colorOf', { name: epic.name })}
              value={epic.colorKey}
              onChange={(colorKey) => app.updateEpic(epic.id, { colorKey })}
            />
          </div>
        )}
        {customFields.map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            value={epic.values[field.id]}
            required={isRequired('epic', app.assignments, field.id)}
            onChange={(value) => app.setFieldValue(epic.id, field.id, value)}
          />
        ))}
        <p className="muted">{t('epics.storyCount', { count })}</p>
        <div className="form__actions dialog__footer">
          <button type="button" className="btn btn--danger-quiet" disabled={count > 0} onClick={remove} aria-describedby={count > 0 ? `${uid}-in-use` : undefined}>
            {t('epics.deleteButton')}
          </button>
          {count > 0 && (
            <span id={`${uid}-in-use`} className="muted">
              {t('epics.inUse', { count })}
            </span>
          )}
          <button type="button" className="btn dialog__footer-end" onClick={onClose}>
            {t('detail.close')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
