import { featureOn } from '../domain/settings';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { criteriaProgress } from '../domain/board';
import { cardFieldsFor, formatValue, releaseLayout } from '../domain/fields';
import type { Epic, Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { AssigneeBadge } from './AssigneeBadge';
import { fieldLabel } from './fieldLabel';
import { DefinitionChip } from './definitions';
import { EpicTag } from './EpicTag';
import { PendingMarker, StoryKey } from './StoryKey';
import { useBuiltin } from './useBuiltin';
import { useMatchClass } from './search/HighlightBar';
import { useStoryMenu } from '../state/StoryMenu';

/** The story title; a click opens the story. The card itself is the keyboard stop (Enter opens it). */
export function TitleButton({ story, className, showTitle = false }: { story: Story; className: string; showTitle?: boolean }) {
  const details = useDetails();
  return (
    <button
      type="button"
      className={`title-button ${className}`}
      tabIndex={-1}
      title={showTitle ? story.title : undefined}
      onClick={(event) => {
        // The card opens the story itself; the title button only gives it a name for assistive technology.
        event.stopPropagation();
        details.openStory(story.id);
      }}
    >
      {story.title}
    </button>
  );
}

/** One small piece of information on a card: a label chip or the value of another field. */
interface Chip {
  key: string;
  text: string;
  /** Tooltip, "Labels: UI". */
  title: string;
  /** What assistive technology reads in front of the text, "Labels: ". */
  prefix: string;
  colors: string[];
}

/** A single select value, such as the priority, as a letter in a coloured square (#55). */
interface Letter {
  key: string;
  letter: string;
  /** "Priority: Must", for the tooltip and assistive technology. */
  title: string;
  color: string;
}

/** The custom fields chosen for the card, split into letters (single select) and chips (everything else). */
function useCardFields(story: Story): { letters: Letter[]; chips: Chip[] } {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const letters: Letter[] = [];
  const chips: Chip[] = [];
  for (const field of cardFieldsFor('story', app.fields, app.assignments)) {
    const value = story.values[field.id];
    if (value === undefined) continue;
    const ids = Array.isArray(value) ? value : [String(value)];
    const chosen = field.options.filter((item) => ids.includes(item.id));
    const name = fieldLabel(t, field);
    if (field.dataType === 'single_select' && chosen.length === 1) {
      const [option] = chosen;
      letters.push({
        key: field.id,
        letter: Array.from(option.label.trim())[0]?.toLocaleUpperCase(i18n.resolvedLanguage) ?? '',
        title: `${name}: ${option.label}`,
        color: option.colorKey
      });
    } else if (field.dataType === 'multi_select' || field.dataType === 'single_select') {
      for (const option of chosen) chips.push({ key: `${field.id}-${option.id}`, text: option.label, title: `${name}: ${option.label}`, prefix: `${name}: `, colors: [option.colorKey] });
    } else if (field.dataType === 'checkbox') {
      // A ticked checkbox shows its name; every other value shows itself.
      chips.push({ key: field.id, text: `✓ ${name}`, title: name, prefix: '', colors: [] });
    } else {
      const text = formatValue(field, value, i18n.resolvedLanguage);
      chips.push({ key: field.id, text, title: `${name}: ${text}`, prefix: `${name}: `, colors: [] });
    }
  }
  return { letters, chips };
}

/** The most chips (labels and other field values) one card line shows; the rest becomes "+n". */
export const MAX_CHIPS = 2;

/** Priority-like single select values as letters (M, S, C, W); the full word is the tooltip and the screen reader text. */
function CardLetters({ letters }: { letters: Letter[] }) {
  if (letters.length === 0) return null;
  return (
    <span className="card__letters">
      {letters.map((item) => (
        <span key={item.key} className="card__letter" title={item.title} style={{ '--letter-color': `var(--epic-${item.color})` } as CSSProperties}>
          <span aria-hidden="true">{item.letter}</span>
          <span className="sr-only">{item.title}</span>
        </span>
      ))}
    </span>
  );
}

/** Labels and other values as mini chips on one line; what does not fit becomes "+n" with a tooltip. */
function CardChips({ chips }: { chips: Chip[] }) {
  const { t } = useTranslation();
  const shown = chips.slice(0, MAX_CHIPS);
  const hidden = chips.slice(MAX_CHIPS);
  return (
    <>
      {shown.map((chip) => (
        <span key={chip.key} className="card-field" title={chip.title}>
          {chip.colors.map((color) => (
            <span key={color} className="epic__dot" style={{ background: `var(--epic-${color})` }} aria-hidden="true" />
          ))}
          {chip.prefix && <span className="sr-only">{chip.prefix}</span>}
          {chip.text}
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="card-field card-field--more" title={t('card.more', { count: hidden.length, names: hidden.map((chip) => chip.text).join(', ') })}>
          <span aria-hidden="true">+{hidden.length}</span>
          <span className="sr-only">{t('card.more', { count: hidden.length, names: hidden.map((chip) => chip.text).join(', ') })}</span>
        </span>
      )}
    </>
  );
}

/** The release of the story as a small tag, when the team set the release field to "On card". */
function CardRelease({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const release = app.releases.find((item) => item.id === story.releaseId);
  if (!release || !featureOn(app.settings, 'releases') || !releaseLayout(app.assignments).onCard) return null;
  return (
    <span className="card-release" title={t('releases.onCard', { title: release.title })}>
      <span className="sr-only">{t('releases.label')}: </span>
      {release.title}
    </span>
  );
}

/** "☑ 2/4": how many acceptance criteria are accepted; green when all are (#55). */
function CardTasks({ story }: { story: Story }) {
  const { t } = useTranslation();
  const progress = criteriaProgress(story);
  if (progress.total === 0) return null;
  const text = t('card.criteria', { done: progress.done, total: progress.total });
  return (
    <span className={`card__tasks${progress.done === progress.total ? ' card__tasks--done' : ''}`} title={text}>
      <span aria-hidden="true">
        ☑ {progress.done}/{progress.total}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function CardPoints({ story }: { story: Story }) {
  const builtin = useBuiltin();
  if (!builtin.shown('story', 'points')) return null;
  return (
    <span className="pill" title={builtin.pointsTitle(story.points)}>
      {story.points}
    </span>
  );
}

interface ContentProps {
  story: Story;
  epic: Epic | undefined;
  /** One line per story. */
  compact: boolean;
}

/** What a card shows: the board gives the form, the story map uses it unchanged (#55). */
export function StoryCardContent({ story, epic, compact }: ContentProps) {
  const builtin = useBuiltin();
  const { letters, chips } = useCardFields(story);
  const showCriteria = builtin.shown('story', 'criteria');

  if (compact) {
    return (
      <>
        <CardLetters letters={letters} />
        <TitleButton story={story} className="card__title" showTitle />
        <StoryKey story={story} onlyLinked />
        <PendingMarker story={story} />
        {epic && builtin.shown('epic', 'color') && (
          <span className="card__epic-dot epic__dot" title={epic.name} style={{ background: `var(--epic-${epic.colorKey})` }}>
            <span className="sr-only">{epic.name}</span>
          </span>
        )}
        {showCriteria && <CardTasks story={story} />}
        <AssigneeBadge story={story} />
        <CardPoints story={story} />
      </>
    );
  }

  return (
    <>
      <div className="card__head">
        <StoryKey story={story} />
        <CardLetters letters={letters} />
        <span className="card__spacer" />
        <AssigneeBadge story={story} />
        <CardPoints story={story} />
      </div>
      <TitleButton story={story} className="card__title" />
      <PendingMarker story={story} />
      <DefinitionChip story={story} kind="done" />
      <div className="card__meta">
        <EpicTag epic={epic} inCard />
        <CardChips chips={chips} />
        <CardRelease story={story} />
        {showCriteria && <CardTasks story={story} />}
      </div>
    </>
  );
}

interface SortableProps {
  story: Story;
  epic: Epic | undefined;
  /** Shows the drop line above this card. */
  dropBefore?: boolean;
  /** One line per story (#55). */
  compact?: boolean;
}

/**
 * A card that is dragged as a whole with mouse, touch or keyboard.
 * A click or Enter opens the story; the context menu offers status, sprint, epic and points (#32).
 */
export function SortableStoryCard({ story, epic, dropBefore = false, compact = false }: SortableProps) {
  const { t } = useTranslation();
  const details = useDetails();
  const menu = useStoryMenu();
  const app = useApp();
  const { attributes, listeners, setNodeRef, isDragging, active } = useSortable({
    id: story.id,
    attributes: { role: 'group', roleDescription: t('board.cardRole') }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && !active && event.target === event.currentTarget) {
      event.preventDefault();
      details.openStory(story.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  const match = useMatchClass(story.id, 'card');
  const classes = ['card', compact && 'card--compact', isDragging && 'card--dragging', dropBefore && 'drop-before', app.flashed === story.id && 'flash', menu.openId === story.id && 'ctx-target', match].filter(Boolean).join(' ');

  return (
    <article
      ref={setNodeRef}
      className={classes}
      data-story-id={story.id}
      {...attributes}
      aria-label={`${story.code}: ${story.title}`}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => details.openStory(story.id)}
      onContextMenu={(event) => menu.openFor(story.id, event)}
    >
      <StoryCardContent story={story} epic={epic} compact={compact} />
    </article>
  );
}

/** The card that follows the pointer while dragging. */
export function OverlayCard({ story, epic, compact = false }: { story: Story; epic: Epic | undefined; compact?: boolean }) {
  return (
    <article className={`card card--overlay${compact ? ' card--compact' : ''}`} aria-hidden="true">
      <StoryCardContent story={story} epic={epic} compact={compact} />
    </article>
  );
}
