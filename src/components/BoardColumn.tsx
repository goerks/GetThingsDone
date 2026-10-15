import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { columnId } from '../domain/board';
import { statusColor } from '../domain/statuses';
import { canStartIn } from '../domain/workflow';
import { LockIcon } from './icons';
import { useApp } from '../state/AppState';
import { statusLabel } from './statusLabel';
import type { Epic, Status, Story } from '../domain/types';
import { keepInPlace } from '../dnd/dnd';
import { SortableStoryCard } from './StoryCard';
import { StoryQuickAdd } from './QuickAdd';

interface Props {
  status: Status;
  stories: Story[];
  epics: Map<string, Epic>;
  /** The running sprint: stories added with "+ Story" belong to it. */
  sprintId: string | null;
  /** Set while a dragged story would land in this column: in front of `beforeId`, or at the end when null. */
  drop?: { beforeId: string | null };
  /** Set while a story is dragged that may not move here (#49): the column is locked; `reason` is shown while the pointer is over it. */
  locked?: { reason: string; hovered: boolean };
}

export function BoardColumn({ status, stories, epics, sprintId, drop, locked }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const { setNodeRef } = useDroppable({ id: columnId(status) });
  const headingId = `column-${status}`;

  return (
    <section
      className={`column${drop ? ' column--target' : ''}${locked ? ' column--locked' : ''}`}
      data-locked={locked ? 'true' : undefined}
      title={locked?.reason}
      aria-labelledby={headingId}
      data-status={status}
      data-drop-target={drop ? 'true' : undefined}
      style={{ '--status-color': statusColor(app.statuses, status) } as CSSProperties}
    >
      <h3 className="column__title">
        <span id={headingId} className="column__name">
          {statusLabel(t, app.statuses, status)}
        </span>
        {locked && (
          <span className="column__lock">
            <LockIcon />
            <span className="sr-only">{locked.reason}</span>
          </span>
        )}
        <span className="column__count">{stories.length}</span>
      </h3>
      {locked?.hovered && (
        <p className="column__reason" role="note">
          {locked.reason}
        </p>
      )}
      <SortableContext items={stories.map((story) => story.id)} strategy={keepInPlace}>
        <ul ref={setNodeRef} className="column__list">
          {stories.map((story) => (
            <li key={story.id}>
              <SortableStoryCard story={story} epic={epics.get(story.epicId ?? '')} dropBefore={drop?.beforeId === story.id} />
            </li>
          ))}
          {drop && drop.beforeId === null && stories.length > 0 && <li className="drop-line" aria-hidden="true" />}
          {stories.length === 0 && <li className="column__empty">{t('board.emptyColumn')}</li>}
        </ul>
      </SortableContext>
      {/* With the workflow on, a story is only added in a status where it may start (#49). */}
      {(!app.settings.workflow.enabled || canStartIn(app.settings.workflow, app.statuses, status)) && (
        <StoryQuickAdd place={statusLabel(t, app.statuses, status)} sprintId={sprintId} status={status} />
      )}
    </section>
  );
}
