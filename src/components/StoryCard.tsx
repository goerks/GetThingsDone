import { featureOn } from '../domain/settings';
import { EstimatePill } from './EstimatePill';
import type { KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { criteriaProgress } from '../domain/board';
import { cardFieldsFor, formatValue, releaseLayout } from '../domain/fields';
import type { Epic, Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { fieldLabel } from './fieldLabel';
import { DefinitionChip } from './definitions';
import { EpicTag } from './EpicTag';
import { useBuiltin } from './useBuiltin';
import { useMatchClass } from './search/HighlightBar';
import { useStoryMenu } from '../state/StoryMenu';

/** The story title; a click opens the story. The card itself is the keyboard stop (Enter opens it). */
export function TitleButton({ story, className }: { story: Story; className: string }) {
  const details = useDetails();
  return (
    <button
      type="button"
      className={`title-button ${className}`}
      tabIndex={-1}
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

/** Values of the custom fields chosen for the card. Select values keep their option colour. */
export function CardFieldValues({ story }: { story: Story }) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const shown = cardFieldsFor('story', app.fields, app.assignments).filter((field) => story.values[field.id] !== undefined);
  if (shown.length === 0) return null;
  return (
    <span className="card-fields">
      {shown.map((field) => {
        const value = story.values[field.id];
        const ids = Array.isArray(value) ? value : [String(value)];
        const colors = field.options.filter((item) => ids.includes(item.id)).map((item) => item.colorKey);
        const name = fieldLabel(t, field);
        // A ticked checkbox shows its name; every other value shows itself.
        const text = field.dataType === 'checkbox' ? `✓ ${name}` : formatValue(field, value, i18n.resolvedLanguage);
        return (
          <span key={field.id} className="card-field" title={field.dataType === 'checkbox' ? name : `${name}: ${text}`}>
            {colors.map((color) => (
              <span key={color} className="epic__dot" style={{ background: `var(--epic-${color})` }} aria-hidden="true" />
            ))}
            {field.dataType !== 'checkbox' && <span className="sr-only">{name}: </span>}
            {text}
          </span>
        );
      })}
    </span>
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

function CardContent({ story, epic }: { story: Story; epic: Epic | undefined }) {
  const { t } = useTranslation();
  const builtin = useBuiltin();
  const progress = criteriaProgress(story);
  return (
    <>
      <span className="card__code">{story.code}</span>
      <TitleButton story={story} className="card__title" />
      <CardFieldValues story={story} />
      <CardRelease story={story} />
      {builtin.shown('story', 'criteria') && (
        <div className="card__progress">
          <div
            className="progress"
            role="img"
            aria-label={t('card.criteria', { done: progress.done, total: progress.total })}
          >
            <div className="progress__bar" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="card__count" aria-hidden="true">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
      <DefinitionChip story={story} kind="done" />
      <div className="card__bottom">
        <EpicTag epic={epic} inCard />
        {builtin.shown('story', 'points') && (
          <EstimatePill story={story} />
        )}
      </div>
    </>
  );
}

interface SortableProps {
  story: Story;
  epic: Epic | undefined;
  /** Shows the drop line above this card. */
  dropBefore?: boolean;
}

/**
 * A card that is dragged as a whole with mouse, touch or keyboard.
 * A click or Enter opens the story; the context menu offers status, sprint, epic and points (#32).
 */
export function SortableStoryCard({ story, epic, dropBefore = false }: SortableProps) {
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
  const classes = ['card', isDragging && 'card--dragging', dropBefore && 'drop-before', app.flashed === story.id && 'flash', menu.openId === story.id && 'ctx-target', match].filter(Boolean).join(' ');

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
      <CardContent story={story} epic={epic} />
    </article>
  );
}

/** The card that follows the pointer while dragging. */
export function OverlayCard({ story, epic }: { story: Story; epic: Epic | undefined }) {
  return (
    <article className="card card--overlay" aria-hidden="true">
      <CardContent story={story} epic={epic} />
    </article>
  );
}
