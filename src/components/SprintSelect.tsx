import { useTranslation } from 'react-i18next';
import { sortSprints } from '../domain/sprints';
import { useApp } from '../state/AppState';
import { formatSprintDates } from './sprintFormat';

const NOT_PLANNED = '';

interface Props {
  id: string;
  value: string | null;
  onChange: (sprintId: string | null) => void;
}

/**
 * Sprint dropdown in time order with "Not planned" at the end. A completed sprint is offered only to a story that
 * is in it (#17), so it keeps showing where it was done.
 */
export function SprintSelect({ id, value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  return (
    <select
      id={id}
      className="select"
      value={value ?? NOT_PLANNED}
      onChange={(event) => onChange(event.target.value === NOT_PLANNED ? null : event.target.value)}
    >
      {sortSprints(app.sprints)
        .filter((sprint) => sprint.state !== 'completed' || sprint.id === value)
        .map((sprint) => (
          <option key={sprint.id} value={sprint.id}>
            {sprint.name} ({formatSprintDates(sprint, i18n.language)}){sprint.state === 'completed' ? ` · ${t('sprint.completed')}` : ''}
          </option>
        ))}
      <option value={NOT_PLANNED}>{t('sprint.notPlanned')}</option>
    </select>
  );
}
