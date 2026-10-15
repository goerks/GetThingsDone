import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';
import { itemText, ListView } from './definitions';
import { statusLabel } from './statusLabel';
import { evaluate } from '../domain/definitions';
import type { DefinitionKind } from '../domain/types';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { useToast } from '../state/Toast';

/**
 * The quality gate (#26): a status change that crosses a Definition list the story does not meet does not happen. The
 * dialog names the problem and shows the items that were open when the step began, with the same checkboxes as the story
 * dialog; "Move" works once they are all resolved. The only other way is a deliberate override, asked for in a second step
 * with the items that stay open. Two lists (not started straight to done) are asked one after the other.
 */
export function TransitionDialog({ storyId, to, gates }: { storyId: string; to: string; gates: DefinitionKind[] }) {
  const { t } = useTranslation();
  const app = useApp();
  const details = useDetails();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [overriding, setOverriding] = useState(false);
  const shown = useRef(new Map<DefinitionKind, Set<string>>());
  const story = app.stories.find((item) => item.id === storyId);
  const kind = gates[step];
  if (!story) return null;
  const list = app.settings.definitions[kind];
  if (!shown.current.has(kind)) {
    const open = evaluate(list, story).groups.flatMap((group) => group.items.filter((entry) => entry.state === 'open').map((entry) => entry.item.id));
    shown.current.set(kind, new Set(open));
  }
  const ids = shown.current.get(kind) ?? new Set<string>();
  const result = evaluate(list, story, ids);
  const overall = evaluate(list, story);
  const last = step === gates.length - 1;
  const target = statusLabel(t, app.statuses, to);
  const cancel = (): void => app.resolveTransition('cancel');
  const openStory = (): void => {
    app.resolveTransition('cancel');
    details.openStory(story.id);
  };
  /** What stays open if the gate is overridden now: the open items of this list and of the lists after it. */
  const staying = gates.slice(step).flatMap((item) =>
    evaluate(app.settings.definitions[item], story).groups.flatMap((group) => group.items.filter((entry) => entry.state === 'open').map((entry) => ({ kind: item, text: itemText(t, entry.item) })))
  );
  const lists = gates.slice(step).filter((item) => !evaluate(app.settings.definitions[item], story).met).map((item) => t(`definitions.${item}`));
  const override = (): void => {
    app.resolveTransition('move');
    toast.notify(t('definitions.toast.overridden', { code: story.code, list: lists.join(' / ') }), { label: t('definitions.toast.open'), onClick: () => details.openStory(story.id) });
  };

  return (
    <Dialog title={t(`definitions.transition.title.${kind}`, { code: story.code, target, count: ids.size })} onClose={cancel}>
      {overriding ? (
        <div role="alert" className="definition-override">
          <h3 className="definition-override__title">{t('definitions.transition.overrideTitle', { list: lists.join(' / '), code: story.code })}</h3>
          <p>{t('definitions.transition.overrideText')}</p>
          <ul className="definition-override__items">
            {staying.map((entry, index) => (
              <li key={`${entry.kind}-${index}`}>{entry.text}</li>
            ))}
          </ul>
          <div className="form__actions definition-actions">
            <button type="button" className="btn" autoFocus onClick={() => setOverriding(false)}>
              {t('definitions.transition.overrideBack')}
            </button>
            <button type="button" className="btn btn--danger" onClick={override}>
              {t('definitions.transition.overrideConfirm')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="definition-route">
            <span className="chip chip--warn">
              <span aria-hidden="true">⚠ </span>
              {t('definitions.transition.gate')}
            </span>{' '}
            {t('definitions.transition.route', { from: statusLabel(t, app.statuses, story.status), to: target, list: t(`definitions.${kind}`) })}
          </p>
          <div className="progress progress--wide" role="img" aria-label={t('definitions.transition.progress', { met: overall.checked + overall.na, total: overall.total, open: overall.open })}>
            <div className="progress__bar" style={{ width: `${overall.total === 0 ? 0 : Math.round(((overall.checked + overall.na) / overall.total) * 100)}%` }} />
          </div>
          <p className="muted">{t('definitions.transition.progress', { met: overall.checked + overall.na, total: overall.total, open: overall.open })}</p>
          <ListView story={story} result={result} collapsible={false} />
          <p className="muted definition-keys">{t('definitions.keys')}</p>
          <div className="form__actions definition-actions">
            <button type="button" className="btn btn--primary" disabled={!result.met} onClick={() => (last ? app.resolveTransition('move') : setStep(step + 1))}>
              {t(last ? 'definitions.transition.move' : 'definitions.transition.next')}
            </button>
            <button type="button" className="btn" onClick={openStory}>
              {t('definitions.transition.openStory')}
            </button>
            <button type="button" className="btn" onClick={cancel}>
              {t('definitions.transition.cancel')}
            </button>
            <button type="button" className="btn btn--link" onClick={() => setOverriding(true)}>
              {t('definitions.transition.override')}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
