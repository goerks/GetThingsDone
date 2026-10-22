import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { categoryOf } from '../domain/statuses';
import { evaluate, inUse, notDone, notReady, type GroupResult, type ItemState, type ListResult } from '../domain/definitions';
import type { DefinitionItem, DefinitionKind, Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { Button, IconButton } from '../ui';

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
 * One item of a list for one story, with one control of three click states: not set, done, ignored ("not relevant"). A click
 * goes on to the next state; an item that may not be ignored only toggles between not set and done. An automatic item shows
 * its own state and can only be set to ignored and back. N sets "ignored" at once (and back) where the item allows it.
 */
export function ItemRow({ story, item, state }: { story: Story; item: DefinitionItem; state: ItemState }) {
  const { t } = useTranslation();
  const app = useApp();
  const automatic = item.rule !== null;
  const text = itemText(t, item);
  const id = useId();
  const canNa = item.mayBeIrrelevant || state === 'na';
  const set = (next: 'checked' | 'na' | null): void => app.setCheck(story.id, item.id, next);
  /** The next click state: not set → done → ignored → not set, leaving out what the item does not allow. */
  const advance = (): void => {
    if (state === 'na') set(null);
    else if (automatic) {
      if (canNa) set('na');
    } else if (state === 'open') set('checked');
    else set(canNa ? 'na' : null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey || !canNa) return;
    event.preventDefault();
    set(state === 'na' ? null : 'na');
  };
  const disabled = automatic && !canNa;
  const label = t(`definitions.state.${state}`);
  return (
    <li className={`definition-item${state === 'na' ? ' definition-item--na' : ''}`} data-state={state}>
      <button
        type="button"
        role="checkbox"
        className={`definition-box definition-box--${state}`}
        aria-checked={state === 'checked' ? true : state === 'na' ? 'mixed' : false}
        aria-labelledby={`${id}-text`}
        aria-describedby={`${id}-state`}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onClick={advance}
      >
        <span aria-hidden="true">{state === 'checked' ? '✓' : state === 'na' ? '–' : ''}</span>
      </button>
      <span id={`${id}-text`} className="definition-item__text" onClick={disabled ? undefined : advance}>
        {text}
      </span>
      <span id={`${id}-state`} className="sr-only">
        {label}
      </span>
      {automatic && (
        <span className="definition-item__auto" title={t('definitions.autoHint')}>
          {t('definitions.automatic')}
        </span>
      )}
    </li>
  );
}

function GroupView({ story, result, collapsible, onlyOpen }: { story: Story; result: GroupResult; collapsible: boolean; onlyOpen: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const id = useId();
  const name = groupName(t, result.group.name);
  const total = result.items.length;
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
        <span className="muted definition-group__count">{counterText(t, { checked: result.checked, total, na: result.na })}</span>
      </div>
      {open && (
        <ul id={id} className="definition-items">
          {result.items
            .filter((entry) => !onlyOpen || entry.state === 'open')
            .map((entry) => (
              <ItemRow key={entry.item.id} story={story} item={entry.item} state={entry.state} />
            ))}
        </ul>
      )}
    </div>
  );
}

/** The groups of a list with their items for one story. With `onlyOpen`, items that are met are left out. */
export function ListView({ story, result, collapsible = true, onlyOpen = false }: { story: Story; result: ListResult; collapsible?: boolean; onlyOpen?: boolean }) {
  const { t } = useTranslation();
  const groups = onlyOpen ? result.groups.filter((group) => group.items.some((entry) => entry.state === 'open')) : result.groups;
  if (onlyOpen && groups.length === 0) return <p className="muted definition-allmet">{t('definitions.allMet')}</p>;
  return (
    <div className="definition-list">
      {groups.map((group) => (
        <GroupView key={group.group.id} story={story} result={group} collapsible={collapsible} onlyOpen={onlyOpen} />
      ))}
    </div>
  );
}

const HIDDEN_KEY = 'getitdone.definitions.hidden';
const ONLY_OPEN_KEY = 'getitdone.definitions.onlyOpen';

/** A choice of this browser (not of the team) that is kept in the local storage; without storage it lives as long as the page. */
function useBrowserFlag(key: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      return window.localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const set = (next: boolean): void => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // the choice then only lasts until the page is closed
    }
  };
  return [value, set];
}

/** The menu "…" of a card: show only the open items, hide the definitions. Escape closes it and returns the focus. */
function CardMenu({ name, onlyOpen, onOnlyOpen, onHide }: { name: string; onlyOpen: boolean; onOnlyOpen: (value: boolean) => void; onHide: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const uid = useId();
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const close = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
  };
  return (
    <div className="definition-menu">
      <IconButton
        type="button"
        ref={button}
        quiet
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        aria-label={t('definitions.menu.label', { name })}
        title={t('definitions.menu.label', { name })}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">⋯</span>
      </IconButton>
      {open && (
        <div id={uid} ref={menu} role="menu" className="definition-menu__list" onKeyDown={onKeyDown}>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={onlyOpen}
            className="definition-menu__item"
            onClick={() => {
              onOnlyOpen(!onlyOpen);
              close();
            }}
          >
            <span aria-hidden="true">{onlyOpen ? '✓ ' : ''}</span>
            {t('definitions.menu.onlyOpen')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="definition-menu__item"
            onClick={() => {
              setOpen(false);
              onHide();
            }}
          >
            {t('definitions.menu.hide')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The block of the story dialog (#26): a card per list that is switched on, Ready and Done one under the other. A card
 * shows its counter and a progress bar and opens to its groups with the checkboxes; the one that fits the status of the
 * story is open. The menu "…" shows only the open items or hides the block (a choice of this browser).
 */
export function DefinitionsPanel({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const { definitions } = app.settings;
  const [hidden, setHidden] = useBrowserFlag(HIDDEN_KEY);
  const [onlyOpen, setOnlyOpen] = useBrowserFlag(ONLY_OPEN_KEY);
  const category = categoryOf(app.statuses, story.status);
  // Only the list that fits the status of the story opens, and only while something in it is still open: Ready in "not started", Done in "in progress".
  const [expanded, setExpanded] = useState<Record<DefinitionKind, boolean>>({
    ready: category === 'not_started' && evaluate(definitions.ready, story).open > 0,
    done: category === 'in_progress' && evaluate(definitions.done, story).open > 0
  });
  const uid = useId();
  const showButton = useRef<HTMLButtonElement>(null);
  const focusShow = useRef(false);
  // After hiding, the focus goes to "Show definitions", so the keyboard does not lose its place.
  useEffect(() => {
    if (hidden && focusShow.current) {
      focusShow.current = false;
      showButton.current?.focus();
    }
  }, [hidden]);
  // Only a list that is switched on shows in the story.
  const kinds = (['ready', 'done'] as const).filter((kind) => inUse(definitions[kind]));
  if (kinds.length === 0) return null;

  if (hidden) {
    return (
      <section className="panel definitions-panel definitions-panel--hidden" aria-label={t('definitions.panelLabel')}>
        <Button type="button" ref={showButton} onClick={() => setHidden(false)}>
          {t('definitions.show')}
        </Button>
        <span className="muted">{kinds.map((kind) => `${t(`definitions.${kind}`)} ${counterText(t, evaluate(definitions[kind], story))}`).join(' · ')} · {t('definitions.hiddenHint')}</span>
      </section>
    );
  }

  return (
    <section className="definitions-panel definitions-cards" aria-label={t('definitions.panelLabel')}>
      {kinds.map((kind) => {
        const result = evaluate(definitions[kind], story);
        const percent = result.total === 0 ? 0 : Math.round(((result.checked + result.na) / result.total) * 100);
        const open = expanded[kind];
        const name = t(`definitions.${kind}`);
        return (
          <article key={kind} className="definition-card" data-kind={kind}>
            <div className="definition-card__head">
              <button
                type="button"
                className="definition-card__toggle"
                aria-expanded={open}
                aria-controls={`${uid}-${kind}`}
                onClick={() => setExpanded({ ...expanded, [kind]: !open })}
              >
                <span aria-hidden="true" className="definition-card__caret">
                  {open ? '▾' : '▸'}
                </span>
                <span className="definition-card__name">{name}</span>
                <span className="muted definition-card__counter">· {counterText(t, result)}</span>
                {!result.met && (
                  <span className="chip chip--warn" title={t('definitions.openItems', { count: result.open })}>
                    <span aria-hidden="true">⚠ </span>
                    <span className="sr-only">{t('definitions.openItems', { count: result.open })}</span>
                    <span aria-hidden="true">{result.open}</span>
                  </span>
                )}
              </button>
              <div className="progress definition-card__meter" aria-hidden="true">
                <div className="progress__bar" style={{ width: `${percent}%` }} />
              </div>
              <CardMenu name={name} onlyOpen={onlyOpen} onOnlyOpen={setOnlyOpen} onHide={() => {
                  focusShow.current = true;
                  setHidden(true);
                }} />
            </div>
            {open && (
              <div id={`${uid}-${kind}`} className="definition-card__body">
                <ListView story={story} result={result} onlyOpen={onlyOpen} />
                <p className="muted definition-keys">{t('definitions.keys')}</p>
              </div>
            )}
          </article>
        );
      })}
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
