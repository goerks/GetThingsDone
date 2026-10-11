import type { KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { criteriaProgress } from '../domain/board';
import type { Epic, Story } from '../domain/types';
import { hrefs, openStory } from '../router';
import { EpicTag } from './EpicTag';

function CardContent({ story, epic }: { story: Story; epic: Epic | undefined }) {
  const { t } = useTranslation();
  const progress = criteriaProgress(story);
  return (
    <>
      <span className="card__code">{story.code}</span>
      {/* The card itself is the keyboard stop (Enter opens it), so the link is for the mouse only. */}
      <a className="card__title" href={hrefs.story(story.id)} tabIndex={-1} draggable={false}>
        {story.title}
      </a>
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
        <EpicTag epic={epic} />
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
  const { attributes, listeners, setNodeRef, isDragging, active } = useSortable({
    id: story.id,
    attributes: { role: 'group', roleDescription: t('board.cardRole') }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && !active && event.target === event.currentTarget) {
      event.preventDefault();
      openStory(story.id);
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
      onDoubleClick={() => openStory(story.id)}
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
