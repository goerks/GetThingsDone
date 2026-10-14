import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { StartState } from '../../domain/testRecorder';
import { RECORDER_ATTR } from '../../state/recorderDom';
import { useRecorder } from '../../state/Recorder';
import { CloseIcon } from '../help/icons';

/** A sentence that can be rewritten in place: Enter keeps it, Escape leaves it as it was. */
function EditableLine({ text, label, onSave, onRemove, removeLabel, editLabel }: { text: string; label: string; onSave: (text: string) => void; onRemove: () => void; removeLabel: string; editLabel: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);
  const done = (save: boolean): void => {
    if (save && value.trim() !== '') onSave(value.trim());
    setEditing(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      done(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      done(false);
    }
  };
  return (
    <>
      {editing ? (
        <input ref={field} className="input recorder__edit" aria-label={label} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={onKeyDown} onBlur={() => done(true)} />
      ) : (
        <span className="recorder__text">{text}</span>
      )}
      <span className="recorder__row-actions">
        {!editing && (
          <button
            type="button"
            className="icon-btn recorder__small"
            aria-label={editLabel}
            title={editLabel}
            onClick={() => {
              setValue(text);
              setEditing(true);
            }}
          >
            <span aria-hidden="true">✎</span>
          </button>
        )}
        <button type="button" className="icon-btn recorder__small" aria-label={removeLabel} title={removeLabel} onMouseDown={(event) => event.preventDefault()} onClick={onRemove}>
          <CloseIcon />
        </button>
      </span>
    </>
  );
}

function NewTestForm() {
  const { t } = useTranslation();
  const recorder = useRecorder();
  const [name, setName] = useState('');
  const [requirement, setRequirement] = useState('');
  const [startState, setStartState] = useState<StartState>('fresh');
  const [problem, setProblem] = useState(false);
  const ids = { name: useId(), requirement: useId(), error: useId() };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (name.trim() === '') {
      setProblem(true);
      return;
    }
    recorder.start({ name, requirement, startState });
  };

  return (
    <form className="recorder__form" onSubmit={submit} noValidate>
      <h3 className="recorder__heading">{t('recorder.new.title')}</h3>
      <div className="field">
        <label htmlFor={ids.name} className="field__label">
          {t('recorder.new.name')}
        </label>
        <input
          id={ids.name}
          className="input"
          value={name}
          autoFocus
          aria-invalid={problem || undefined}
          aria-describedby={problem ? ids.error : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(false);
          }}
        />
        {problem && (
          <p id={ids.error} className="field__error" role="alert">
            {t('recorder.new.nameMissing')}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={ids.requirement} className="field__label">
          {t('recorder.new.requirement')}
        </label>
        <input id={ids.requirement} className="input" value={requirement} placeholder={t('recorder.new.requirementHint')} onChange={(event) => setRequirement(event.target.value)} />
      </div>
      <fieldset className="field">
        <legend className="field__label">{t('recorder.new.start')}</legend>
        <label className="recorder__choice">
          <input type="radio" name="recorder-start" checked={startState === 'fresh'} onChange={() => setStartState('fresh')} />
          {t('recorder.new.startFresh')}
        </label>
        <label className="recorder__choice">
          <input type="radio" name="recorder-start" checked={startState === 'current'} onChange={() => setStartState('current')} />
          {t('recorder.new.startCurrent')}
        </label>
      </fieldset>
      <div className="form__actions">
        <button type="submit" className="btn btn--primary">
          {t('recorder.new.begin')}
        </button>
        <button type="button" className="btn" onClick={recorder.cancelCreating}>
          {t('recorder.cancel')}
        </button>
      </div>
    </form>
  );
}

function DraftView() {
  const { t } = useTranslation();
  const recorder = useRecorder();
  const draft = recorder.state.draft;
  const [adding, setAdding] = useState(false);
  const [sentence, setSentence] = useState('');
  const [own, setOwn] = useState('');
  const [problem, setProblem] = useState<'name' | 'expected' | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const stepsEnd = useRef<HTMLLIElement>(null);
  const count = draft?.test.steps.length ?? 0;
  useEffect(() => {
    // The newest step stays in view while the list grows.
    if (typeof stepsEnd.current?.scrollIntoView === 'function') stepsEnd.current.scrollIntoView({ block: 'nearest' });
  }, [count]);
  if (!draft) return null;
  const { test } = draft;
  const status = draft.editing ? t('recorder.status.editing') : draft.paused ? t('recorder.status.paused') : t('recorder.status.recording');

  const finish = (): void => {
    const result = recorder.finish();
    setProblem(result);
  };

  return (
    <div className="recorder__body">
      <h3 className="recorder__heading">
        <span className={`recorder__dot${!draft.editing && !draft.paused ? ' recorder__dot--live' : ''}`} aria-hidden="true" />
        {test.name || t('recorder.untitled')}
      </h3>
      <p className="muted recorder__meta">
        {[status, test.requirement, test.startState === 'fresh' ? t('recorder.new.startFresh') : t('recorder.new.startCurrent')].filter(Boolean).join(' · ')}
      </p>

      {draft.editing && (
        <div className="recorder__rename">
          <div className="field">
            <label className="field__label" htmlFor="recorder-name">
              {t('recorder.new.name')}
            </label>
            <input id="recorder-name" className="input" value={test.name} onChange={(event) => recorder.changeTest((current) => ({ ...current, name: event.target.value }))} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="recorder-requirement">
              {t('recorder.new.requirement')}
            </label>
            <input id="recorder-requirement" className="input" value={test.requirement} onChange={(event) => recorder.changeTest((current) => ({ ...current, requirement: event.target.value }))} />
          </div>
        </div>
      )}

      <h4 className="recorder__sub">{t('recorder.steps.title', { count })}</h4>
      {count === 0 ? (
        <p className="muted">{t('recorder.steps.none')}</p>
      ) : (
        <ol className="recorder__steps" aria-label={t('recorder.steps.label')}>
          {test.steps.map((step) => (
            <li key={step.id} className="recorder__step">
              <EditableLine
                text={step.text}
                label={t('recorder.steps.sentence')}
                editLabel={t('recorder.steps.edit')}
                removeLabel={t('recorder.steps.remove')}
                onSave={(text) => recorder.updateStepText(step.id, text)}
                onRemove={() => recorder.removeStepById(step.id)}
              />
            </li>
          ))}
          <li ref={stepsEnd} aria-hidden="true" className="recorder__end" />
        </ol>
      )}

      {adding ? (
        <form
          className="recorder__add"
          onSubmit={(event) => {
            event.preventDefault();
            recorder.addManualStep(sentence);
            setSentence('');
            setAdding(false);
          }}
        >
          <input className="input" aria-label={t('recorder.steps.sentence')} value={sentence} autoFocus onChange={(event) => setSentence(event.target.value)} />
          <button type="submit" className="btn">
            {t('recorder.add')}
          </button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>
            {t('recorder.cancel')}
          </button>
        </form>
      ) : (
        <button type="button" className="btn recorder__wide" onClick={() => setAdding(true)}>
          <span aria-hidden="true">＋ </span>{t('recorder.steps.add')}
        </button>
      )}

      <h4 className="recorder__sub">{t('recorder.expected.title')}</h4>
      {test.expected.length === 0 ? (
        <p className="muted">{t('recorder.expected.none')}</p>
      ) : (
        <ul className="recorder__steps recorder__steps--expected" aria-label={t('recorder.expected.label')}>
          {test.expected.map((item) => (
            <li key={item.id} className="recorder__step recorder__step--expected">
              <EditableLine
                text={item.text}
                label={t('recorder.expected.sentence')}
                editLabel={t('recorder.expected.edit')}
                removeLabel={t('recorder.expected.remove')}
                onSave={(text) => recorder.updateExpectedText(item.id, text)}
                onRemove={() => recorder.removeExpectedById(item.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {recorder.picking ? (
        <div className="recorder__pick" role="status">
          <p>{t('recorder.expected.pointing')}</p>
          <button type="button" className="btn" onClick={recorder.cancelPick}>
            {t('recorder.cancel')}
          </button>
        </div>
      ) : recorder.picked ? (
        <div className="recorder__pick">
          <p>{t('recorder.expected.choose')}</p>
          <ul className="recorder__suggestions">
            {recorder.picked.suggestions.map((text) => (
              <li key={text}>
                <button type="button" className="btn recorder__suggestion" onClick={() => recorder.addExpectedText(text, recorder.picked?.target)}>
                  {text}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={recorder.cancelPick}>
            {t('recorder.cancel')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="btn recorder__wide" onClick={recorder.beginPick}>
            <span aria-hidden="true">✓ </span>{t('recorder.expected.point')}
          </button>
          <form
            className="recorder__add"
            onSubmit={(event) => {
              event.preventDefault();
              recorder.addExpectedText(own);
              setOwn('');
              setProblem(null);
            }}
          >
            <input className="input" aria-label={t('recorder.expected.own')} placeholder={t('recorder.expected.own')} value={own} onChange={(event) => setOwn(event.target.value)} />
            <button type="submit" className="btn">
              {t('recorder.add')}
            </button>
          </form>
        </>
      )}

      {problem && (
        <p className="field-error" role="alert">
          {problem === 'name' ? t('recorder.new.nameMissing') : t('recorder.expected.missing')}
        </p>
      )}

      <div className="recorder__actions">
        {!draft.editing && (
          <button type="button" className="btn" onClick={() => recorder.setPaused(!draft.paused)} aria-pressed={draft.paused}>
            {draft.paused ? t('recorder.resume') : t('recorder.pause')}
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={finish}>
          {draft.editing ? t('recorder.save') : t('recorder.finish')}
        </button>
        {confirmDiscard ? (
          <>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                setConfirmDiscard(false);
                recorder.discardDraft();
              }}
            >
              {t('recorder.discardYes')}
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDiscard(false)}>
              {t('recorder.cancel')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--danger-quiet" onClick={() => setConfirmDiscard(true)}>
            {draft.editing ? t('recorder.cancelEdit') : t('recorder.discard')}
          </button>
        )}
      </div>
    </div>
  );
}

function HomeView() {
  const { t } = useTranslation();
  const recorder = useRecorder();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const { collection } = recorder.state;

  return (
    <div className="recorder__body">
      <p className="muted">{t('recorder.home.intro')}</p>
      <button type="button" className="btn btn--primary recorder__wide" onClick={recorder.startCreating}>
        <span aria-hidden="true">＋ </span>{t('recorder.home.newTest')}
      </button>

      <h3 className="recorder__heading">{t('recorder.home.yourTests', { count: collection.length })}</h3>
      {collection.length === 0 ? (
        <p className="muted">{t('recorder.home.none')}</p>
      ) : (
        <ul className="recorder__list">
          {collection.map((entry) => (
            <li key={entry.id} className="recorder__entry">
              <div className="recorder__entry-main">
                <strong>{entry.name}</strong>
                <span className="muted">
                  {[entry.requirement, t('recorder.home.stepCount', { count: entry.steps.length })].filter(Boolean).join(' · ')}
                </span>
              </div>
              {confirmId === entry.id ? (
                <div className="recorder__confirm" role="group" aria-label={t('recorder.home.confirmDelete', { name: entry.name })}>
                  <span>{t('recorder.home.confirmDelete', { name: entry.name })}</span>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => {
                      recorder.deleteEntry(entry.id);
                      setConfirmId(null);
                    }}
                  >
                    {t('recorder.home.deleteYes')}
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirmId(null)}>
                    {t('recorder.cancel')}
                  </button>
                </div>
              ) : (
                <div className="recorder__entry-actions">
                  <button type="button" className="btn" aria-label={t('recorder.home.editNamed', { name: entry.name })} onClick={() => recorder.editEntry(entry.id)}>
                    {t('recorder.home.edit')}
                  </button>
                  <button type="button" className="btn btn--danger-quiet" aria-label={t('recorder.home.deleteNamed', { name: entry.name })} onClick={() => setConfirmId(entry.id)}>
                    {t('recorder.home.delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="recorder__heading">{t('recorder.home.export')}</h3>
      <p className="muted">{t('recorder.home.exportHint')}</p>
      <button type="button" className="btn btn--primary recorder__wide" onClick={() => void recorder.copyAll()}>
        {t('recorder.home.copyAll')}
      </button>
      {collection.length > 0 && (
        <>
          <button type="button" className="btn recorder__wide" aria-expanded={showText} onClick={() => setShowText((current) => !current)}>
            {showText ? t('recorder.home.hideText') : t('recorder.home.showText')}
          </button>
          {showText && <textarea className="input recorder__text-preview" readOnly aria-label={t('recorder.home.textLabel')} value={recorder.exportText()} />}
        </>
      )}
    </div>
  );
}

/** The test builder: a bar fixed to the right edge. The app makes room for it. Only in the web preview. */
export function RecorderBar() {
  const { t } = useTranslation();
  const recorder = useRecorder();
  const { panel, state, creating } = recorder;
  const draft = state.draft;
  const live = draft !== null && !draft.paused && !draft.editing;

  if (panel === 'rail') {
    return (
      <aside className="recorder recorder--rail" {...{ [RECORDER_ATTR]: 'true' }} aria-label={t('recorder.panelLabel')}>
        <button type="button" className="icon-btn" onClick={recorder.expand} aria-label={t('recorder.expand')} title={t('recorder.expand')}>
          <span aria-hidden="true">◂</span>
        </button>
        <span className={`recorder__dot${live ? ' recorder__dot--live' : ''}`} aria-hidden="true" />
        <span className="recorder__rail-count">{t('recorder.rail', { count: draft?.test.steps.length ?? 0 })}</span>
        <span className="sr-only" role="status">
          {recorder.notice}
        </span>
      </aside>
    );
  }

  return (
    <aside className="recorder" {...{ [RECORDER_ATTR]: 'true' }} aria-label={t('recorder.panelLabel')}>
      <div className="recorder__head">
        <h2 className="recorder__title">{t('recorder.title')}</h2>
        <button type="button" className="icon-btn" onClick={recorder.collapse} aria-label={draft ? t('recorder.collapse') : t('recorder.close')} title={draft ? t('recorder.collapse') : t('recorder.close')}>
          {draft ? <span aria-hidden="true">▸</span> : <CloseIcon />}
        </button>
      </div>
      <p className="sr-only" role="status">
        {recorder.notice}
      </p>
      {draft ? <DraftView /> : creating ? <NewTestForm /> : <HomeView />}
    </aside>
  );
}
