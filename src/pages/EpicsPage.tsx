import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NewEpicDialog } from '../components/EpicDialogs';
import { NewButton } from '../components/NewButton';
import { sortEpics, storiesInEpic } from '../domain/epics';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { useBuiltin } from '../components/useBuiltin';
import { useSearchPage } from '../state/Search';
import { useMatchClass } from '../components/search/HighlightBar';
import type { Epic } from '../domain/types';
import { useNewShortcut } from '../components/useNewShortcut';

/** List of all epics; a click opens the epic in a dialog. */
export function EpicsPage() {
  const { t } = useTranslation();
  const app = useApp();
  const [creating, setCreating] = useState(false);
  useSearchPage(t('nav.epics'), { epic: app.epics.map((epic) => epic.id) });
  useNewShortcut(() => setCreating(true), !creating);

  return (
    <>
      <div className="page-head">
        <h1>{t('epics.title')}</h1>
        <span className="muted">{t('epics.hint')}</span>
        <NewButton label={t('epics.new')} onClick={() => setCreating(true)} />
      </div>
      {creating && <NewEpicDialog onClose={() => setCreating(false)} />}
      <div className="epics">
        {app.epics.length === 0 ? (
          <p className="muted">{t('epics.none')}</p>
        ) : (
          <ul className="epic-list">
            {sortEpics(app.epics).map((epic) => (
              <EpicRow key={epic.id} epic={epic} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function EpicRow({ epic }: { epic: Epic }) {
  const { t } = useTranslation();
  const builtin = useBuiltin();
  const app = useApp();
  const details = useDetails();
  const match = useMatchClass(epic.id, 'epic-row', 'epic');
  return (
    <li>
      <button
        type="button"
        className={`epic-row${match ? ` ${match}` : ''}`}
        data-epic-id={epic.id}
        onClick={() => details.openEpic(epic.id)}
      >
        {builtin.shown('epic', 'color') && (
          <span className="epic__dot epic-row__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
        )}
        <span className="epic-row__name">{epic.name}</span>
        <span className="muted epic-row__count">{t('epics.storyCount', { count: storiesInEpic(app.stories, epic.id) })}</span>
      </button>
    </li>
  );
}
