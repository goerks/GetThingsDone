import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { validateRelease, type ReleaseInput } from '../domain/releases';
import { useApp } from '../state/AppState';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';
import { useBuiltin } from './useBuiltin';

/** Dialog for a new release: title (required), description, and optional start and end day. */
export function NewReleaseDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const [input, setInput] = useState<ReleaseInput>({ title: '', description: '', startDate: null, endDate: null });
  const [showProblem, setShowProblem] = useState(false);
  const problem = validateRelease(input);
  const showStart = builtin.shown('release', 'start');
  const showEnd = builtin.shown('release', 'end');

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (problem) {
      setShowProblem(true);
      return;
    }
    const id = app.createRelease(input);
    if (!id) return;
    onCreated?.(id);
    onClose();
  };

  const change = (field: keyof ReleaseInput) => (event: { target: { value: string } }) =>
    setInput((current) => ({ ...current, [field]: field === 'startDate' || field === 'endDate' ? event.target.value || null : event.target.value }));

  return (
    <Dialog title={t('releases.new')} dirty={Boolean(input.title.trim() || input.description.trim() || input.startDate || input.endDate)} submitShortcut onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${uid}-title`}>{builtin.label('title', t('releases.name'))}</label>
          <input id={`${uid}-title`} className="input" value={input.title} onChange={change('title')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor={`${uid}-description`}>{builtin.label('description', t('releases.description'))}</label>
          <textarea id={`${uid}-description`} className="input" rows={3} value={input.description} onChange={change('description')} />
        </div>
        {(showStart || showEnd) && (
          <div className="form__row">
            {showStart && (
              <div className="field">
                <label htmlFor={`${uid}-start`}>{builtin.label('start', t('releases.start'))}</label>
                <input id={`${uid}-start`} type="date" className="input" value={input.startDate ?? ''} onChange={change('startDate')} />
              </div>
            )}
            {showEnd && (
              <div className="field">
                <label htmlFor={`${uid}-end`}>{builtin.label('end', t('releases.end'))}</label>
                <input id={`${uid}-end`} type="date" className="input" value={input.endDate ?? ''} onChange={change('endDate')} />
              </div>
            )}
          </div>
        )}
        <p className="muted">{t('releases.noDatesNote')}</p>
        {showProblem && problem && (
          <p role="alert" className="field-error">
            {t(`releases.problem.${problem}`)}
          </p>
        )}
        <DialogFooter submit={t('releases.add')} onCancel={onClose} />
      </form>
    </Dialog>
  );
}
