import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { columnId } from '../domain/board';
import type { Epic, Status, Story } from '../domain/types';
import { SortableStoryCard } from './StoryCard';

interface Props {
  status: Status;
  stories: Story[];
  epics: Map<string, Epic>;
}

export function BoardColumn({ status, stories, epics }: Props) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const headingId = `column-${status}`;

  return (
    <section className="column" aria-labelledby={headingId} data-status={status}>
      <h2 className="column__title">
        <span id={headingId}>{t(`status.${status}`)}</span>
        <span className="column__count">{stories.length}</span>
      </h2>
      <SortableContext items={stories.map((story) => story.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className={`column__list${isOver ? ' column__list--over' : ''}`}>
          {stories.map((story) => (
            <li key={story.id}>
              <SortableStoryCard story={story} epic={epics.get(story.epicId)} />
            </li>
          ))}
          {stories.length === 0 && <li className="column__empty">{t('board.emptyColumn')}</li>}
        </ul>
      </SortableContext>
    </section>
  );
}
