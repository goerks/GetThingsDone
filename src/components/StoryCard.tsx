import type { KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { criteriaProgress } from '../domain/board';
import { cardFieldsFor, formatValue } from '../domain/fields';
import type { Epic, Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { fieldLabel } from './fieldLabel';
import { EpicTag } from './EpicTag';

/** The story title; a click opens the story. The card itself is the keyboard stop (Enter opens it). */
export function TitleButton({ story, className }: { story: Story; className: string }) {
  const details = useDetails();
  return (
    <button
      type="button"
      className={`title-button ${className}`}
      tabIndex={-1}
      onClick={() => details.openStory(story.id)}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {story.title}
    </button>
  );
}

/** Values of the custom fields chosen for the card. Select values keep their option colour. */
export function CardFieldValues({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const shown = cardFieldsFor('story', app.fields, app.assignments).filter((field) => story.values[field.id] !== undefined);
  if (shown.length === 0) return null;
  return (
    <span className="card-fields">
      {shown.map((field) => {
        const value = story.values[field.id];
        const option = field.dataType === 'single_select' ? field.options.find((item) => item.id === value) : undefined;
        const name = fieldLabel(t, field);
        const text = formatValue(field, value);
        return (
          <span key={field.id} className="card-field" title={`${name}: ${text}`}>
            {option && <span className="epic__dot" style={{ background: `var(--epic-${option.colorKey})` }} aria-hidden="true" />}
            <span className="sr-only">{name}: </span>
            {text}
          </span>
        );
      })}
    </span>
  );
}

function CardContent({ story, epic }: { story: Story; epic: Epic | undefined }) {
  const { t } = useTranslation();
  const progress = criteriaProgress(story);
  return (
    <>
      <span className="card__code">{story.code}</span>
      <TitleButton story={story} className="card__title" />
      <CardFieldValues story={story} />
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
      <div className="card__bottom">
        <EpicTag epic={epic} inCard />
        <span className="pill" title={t('card.points', { count: story.points })}>
          {story.points}
        </span>
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
 * Double click or Enter opens the story.
 */
export function SortableStoryCard({ story, epic, dropBefore = false }: SortableProps) {
  const { t } = useTranslation();
  const details = useDetails();
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

  const classes = ['card', isDragging && 'card--dragging', dropBefore && 'drop-before'].filter(Boolean).join(' ');

  return (
    <article
      ref={setNodeRef}
      className={classes}
      data-story-id={story.id}
      {...attributes}
      aria-label={`${story.code}: ${story.title}`}
      {...listeners}
      onKeyDown={onKeyDown}
      onDoubleClick={() => details.openStory(story.id)}
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
