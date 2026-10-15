import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { evaluate, itemsOf, notDone, notReady, type GroupResult, type ItemState, type ListResult } from '../domain/definitions';
import type { DefinitionItem, DefinitionKind, Story } from '../domain/types';
import { useApp } from '../state/AppState';

/** The text of an item: its own text, or the translated text of an automatic check. */
export function itemText(t: TFunction, item: DefinitionItem): string {
  return item.rule ? t(`definitions.rule.${item.rule}`) : item.text;
}

export function groupName(t: TFunction, name: string): string {
  return name || t('definitions.generalGroup');
}

/** "3/5", with " · 1 n/a" when items are not relevant. */
export function counterText(t: TFunction, result: { checked: number; total: number; na: number }): string {
  const base = `${result.checked}/${result.total}`;
  return result.na > 0 ? `${base} · ${t('definitions.naCount', { count: result.na })}` : base;
}

/**
 * One item of a list for one story: a checkbox, and a quiet button for "not relevant" where the item allows it.
 * Automatic items show their own state and cannot be ticked. Space ticks, N toggles "not relevant".
 */
export function ItemRow({ story, item, state }: { story: Story; item: DefinitionItem; state: ItemState }) {
  const { t } = useTranslation();
  const app = useApp();
  const box = useRef<HTMLInputElement>(null);
  const automatic = item.rule !== null;
  const text = itemText(t, item);
  // A "not relevant" item shows a dash; a checkbox only knows "mixed" for that.
  useEffect(() => {
    if (box.current) box.current.indeterminate = state === 'na';
  }, [state]);
  const canNa = item.mayBeIrrelevant || state === 'na';
  const toggleNa = (): void => app.setCheck(story.id, item.id, state === 'na' ? null : 'na');
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey || !canNa) return;
    event.preventDefault();
    toggleNa();
  };
  return (
    <li className={`definition-item${state === 'na' ? ' definition-item--na' : ''}`} data-state={state}>
      <label className="definition-item__label">
        <input
          ref={box}
          type="checkbox"
          checked={state === 'checked'}
          disabled={automatic || state === 'na'}
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onChange={() => app.setCheck(story.id, item.id, state === 'checked' ? null : 'checked')}
        />
        <span className="definition-item__text">{text}</span>
        {automatic && (
          <span className="definition-item__auto" title={t('definitions.autoHint')}>
            {t('definitions.automatic')}
          </span>
        )}
        {state === 'na' && <span className="sr-only">{t('definitions.stateNa')}</span>}
      </label>
      {canNa && (
        <button
          type="button"
          className="btn btn--small btn--quiet"
          onKeyDown={onKeyDown}
          aria-label={t(state === 'na' ? 'definitions.relevantAgainFor' : 'definitions.notRelevantFor', { text })}
          onClick={toggleNa}
        >
          {t(state === 'na' ? 'definitions.relevantAgain' : 'definitions.notRelevant')}
        </button>
      )}
    </li>
  );
}

function GroupView({ story, result, collapsible }: { story: Story; result: GroupResult; collapsible: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const id = useId();
  const name = groupName(t, result.group.name);
  const total = result.items.length;
  const percent = total === 0 ? 0 : Math.round(((result.checked + result.na) / total) * 100);
  return (
    <div className="definition-group">
      <div className="definition-group__head">
        {collapsible ? (
          <button type="button" className="definition-group__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
            <span aria-hidden="true">{open ? '▾' : '▸'}</span> {name}
          </button>
        ) : (
          <h3 className="definition-group__name">{name}</h3>
        )}
        <div className="progress definition-group__meter" aria-hidden="true">
          <div className="progress__bar" style={{ width: `${percent}%` }} />
        </div>
        <span className="muted definition-group__count">{counterText(t, { checked: result.checked, total, na: result.na })}</span>
      </div>
      {open && (
        <ul id={id} className="definition-items">
          {result.items.map((entry) => (
            <ItemRow key={entry.item.id} story={story} item={entry.item} state={entry.state} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The groups of a list with their items for one story. */
export function ListView({ story, result, collapsible = true }: { story: Story; result: ListResult; collapsible?: boolean }) {
  return (
    <div className="definition-list">
      {result.groups.map((group) => (
        <GroupView key={group.group.id} story={story} result={group} collapsible={collapsible} />
      ))}
    </div>
  );
}

/** The panel in the story dialog (#26): one tab per list that has items, the groups with their checkboxes below. */
export function DefinitionsPanel({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const { definitions } = app.settings;
  const kinds = (['ready', 'done'] as const).filter((kind) => itemsOf(definitions[kind]).length > 0);
  const [chosen, setChosen] = useState<DefinitionKind>('ready');
  const uid = useId();
  if (kinds.length === 0) return null;
  const kind = kinds.includes(chosen) ? chosen : kinds[0];
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (kinds.length < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    event.stopPropagation();
    const next = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
    setChosen(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <section className="panel definitions-panel" aria-label={t('definitions.panelLabel')}>
      <div role="tablist" aria-label={t('definitions.panelLabel')} className="definitions-tabs" onKeyDown={onKeyDown}>
        {kinds.map((item) => {
          const result = evaluate(definitions[item], story);
          return (
            <button
              key={item}
              type="button"
              role="tab"
              id={`${uid}-tab-${item}`}
              aria-selected={item === kind}
              aria-controls={`${uid}-panel`}
              tabIndex={item === kind ? 0 : -1}
              className={`definitions-tab${item === kind ? ' definitions-tab--on' : ''}`}
              onClick={() => setChosen(item)}
            >
              {t(`definitions.${item}`)} · {counterText(t, result)}
              {!result.met && (
                <span className="definitions-tab__warn" title={t('definitions.openItems', { count: result.open })}>
                  <span aria-hidden="true"> ⚠</span>
                  <span className="sr-only"> {t('definitions.openItems', { count: result.open })}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${kind}`}>
        <ListView story={story} result={evaluate(definitions[kind], story)} />
        <p className="muted definition-keys">{t('definitions.keys')}</p>
      </div>
    </section>
  );
}

/**
 * The mark on a card or row (#26): "Not ready 3/4" in the backlog for stories that are not done, "Not done 1/3" on the
 * board for done stories. Icon and text, never colour alone. Nothing when the lists are empty or met.
 */
export function DefinitionChip({ story, kind }: { story: Story; kind: DefinitionKind }) {
  const { t } = useTranslation();
  const app = useApp();
  const done = app.isDone(story);
  const result = kind === 'ready' ? notReady(app.settings.definitions, story, done) : notDone(app.settings.definitions, story, done);
  if (!result) return null;
  const label = t(kind === 'ready' ? 'definitions.chip.notReady' : 'definitions.chip.notDone', { counter: counterText(t, result) });
  return (
    <span className={`chip chip--warn definition-chip definition-chip--${kind}`} title={t('definitions.openItems', { count: result.open })}>
      <span aria-hidden="true">⚠ </span>
      {label}
    </span>
  );
}
