import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NewEpicDialog } from '../components/EpicDialogs';
import { sortEpics, storiesInEpic } from '../domain/epics';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { useBuiltin } from '../components/useBuiltin';

/** List of all epics; a click opens the epic in a dialog. */
export function EpicsPage() {
  const { t } = useTranslation();
  const builtin = useBuiltin();
  const app = useApp();
  const details = useDetails();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="page-head">
        <h1>{t('epics.title')}</h1>
        <span className="muted">{t('epics.hint')}</span>
        <button type="button" className="btn btn--primary page-head__action" onClick={() => setCreating(true)}>
          {t('epics.new')}
        </button>
      </div>
      {creating && <NewEpicDialog onClose={() => setCreating(false)} />}
      <div className="epics">
        {app.epics.length === 0 ? (
          <p className="muted">{t('epics.none')}</p>
        ) : (
          <ul className="epic-list">
            {sortEpics(app.epics).map((epic) => (
              <li key={epic.id}>
                <button
                  type="button"
                  className="epic-row"
                  onClick={() => details.openEpic(epic.id)}
                  onDoubleClick={() => details.openEpic(epic.id)}
                >
                  {builtin.shown('epic', 'color') && (
                    <span className="epic__dot epic-row__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
                  )}
                  <span className="epic-row__name">{epic.name}</span>
                  <span className="muted epic-row__count">{t('epics.storyCount', { count: storiesInEpic(app.stories, epic.id) })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
