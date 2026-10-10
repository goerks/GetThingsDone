import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { criteriaProgress } from '../domain/board';
import type { Epic, Story } from '../domain/types';
import { hrefs } from '../router';
import { EpicTag } from './EpicTag';

interface ContentProps {
  story: Story;
  epic: Epic | undefined;
  handle: ReactNode;
}

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3" r="1.4" />
      <circle cx="11" cy="3" r="1.4" />
      <circle cx="5" cy="8" r="1.4" />
      <circle cx="11" cy="8" r="1.4" />
      <circle cx="5" cy="13" r="1.4" />
      <circle cx="11" cy="13" r="1.4" />
    </svg>
  );
}

function CardContent({ story, epic, handle }: ContentProps) {
  const { t } = useTranslation();
  const progress = criteriaProgress(story);
  return (
    <>
      <div className="card__top">
        <span className="card__code">{story.code}</span>
        {handle}
      </div>
      <a className="card__title" href={hrefs.story(story.id)}>
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

/** A card that can be dragged with mouse, touch or keyboard through its handle. */
export function SortableStoryCard({ story, epic }: { story: Story; epic: Epic | undefined }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id
  });

  return (
    <article
      ref={setNodeRef}
      className={`card${isDragging ? ' card--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-story-id={story.id}
    >
      <CardContent
        story={story}
        epic={epic}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="drag-handle"
            aria-label={t('board.dragHandle', { title: story.title })}
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        }
      />
    </article>
  );
}

/** The card that follows the pointer while dragging. */
export function OverlayCard({ story, epic }: { story: Story; epic: Epic | undefined }) {
  return (
    <article className="card card--overlay">
      <CardContent
        story={story}
        epic={epic}
        handle={
          <span className="drag-handle" aria-hidden="true">
            <GripIcon />
          </span>
        }
      />
    </article>
  );
}
