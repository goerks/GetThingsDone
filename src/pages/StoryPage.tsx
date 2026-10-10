import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EpicTag } from '../components/EpicTag';
import { criteriaProgress } from '../domain/board';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';

export function StoryPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [draft, setDraft] = useState('');

  const story = app.stories.find((item) => item.id === id);
  if (!story) {
    return (
      <>
        <a className="back" href={hrefs.board}>
          ← {t('detail.back')}
        </a>
        <p>{t('detail.notFound')}</p>
      </>
    );
  }

  const epic = app.epics.find((item) => item.id === story.epicId);
  const progress = criteriaProgress(story);
  const allAccepted = progress.total > 0 && progress.done === progress.total;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!draft.trim()) return;
    app.addCriterion(story.id, draft);
    setDraft('');
  };

  return (
    <>
      <a className="back" href={hrefs.board}>
        ← {t('detail.back')}
      </a>
      <div className="detail">
        <div className="detail__main">
          <div>
            <div className="detail__meta">
              <span className="card__code">{story.code}</span>
              <EpicTag epic={epic} />
            </div>
            <h1>{story.title}</h1>
          </div>

          <section className="panel">
            <h2>{t('detail.description')}</h2>
            <p>{story.description || t('detail.noDescription')}</p>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>{t('detail.criteria')}</h2>
              <span className="muted">{t('detail.progress', { done: progress.done, total: progress.total })}</span>
            </div>
            <div className="progress progress--wide" aria-hidden="true">
              <div className="progress__bar" style={{ width: `${progress.percent}%` }} />
            </div>
            {story.criteria.length === 0 ? (
              <p className="muted">{t('detail.noCriteria')}</p>
            ) : (
              <ul className="criteria">
                {story.criteria.map((criterion) => (
                  <li key={criterion.id}>
                    <label className="criteria__item">
                      <input
                        type="checkbox"
                        checked={criterion.done}
                        onChange={() => app.toggleCriterion(story.id, criterion.id)}
                      />
                      <span>{criterion.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {allAccepted && (
              <div role="status" className="notice">
                {t('detail.allAccepted')}
              </div>
            )}
            <form className="inline-form" onSubmit={submit}>
              <label htmlFor={`${uid}-criterion`} className="sr-only">
                {t('detail.newCriterion')}
              </label>
              <input
                id={`${uid}-criterion`}
                className="input"
                placeholder={t('detail.newCriterion')}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="btn">
                {t('detail.addCriterion')}
              </button>
            </form>
          </section>
        </div>

        <aside className="panel detail__side">
          <h2>{t('detail.details')}</h2>
          <dl className="facts">
            <dt>{t('detail.status')}</dt>
            <dd>{t(`status.${story.status}`)}</dd>
            <dt>{t('detail.epic')}</dt>
            <dd>{epic?.name}</dd>
            <dt>{t('detail.points')}</dt>
            <dd>{story.points}</dd>
            <dt>{t('detail.sprint')}</dt>
            <dd>{story.inSprint ? t('backlog.inSprint') : t('backlog.notInSprint')}</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}
