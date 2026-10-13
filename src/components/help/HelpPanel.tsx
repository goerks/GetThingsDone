import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { searchHelp } from '../../domain/helpSearch';
import { TOUR_STEPS, activeStep, doneCount, type TourStepId } from '../../domain/helpTour';
import { TOPICS, TOUR_STEP_VIEW, TOUR_TOPIC_ID, pageOfStep, type PageKey, type ShowSpec, type TopicDef } from '../../help/topics';
import { useHelpEntries } from '../../help/useTopics';
import { hrefs, type Route } from '../../router';
import { useHelp } from '../../state/Help';
import { Highlighted } from '../search/Highlighted';
import { CloseIcon } from './icons';

/** Moves between the buttons of a list with the arrow keys; the first ArrowUp goes back to the field. */
function moveInList(event: KeyboardEvent<HTMLElement>, root: HTMLElement | null): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  if (!root) return;
  const items = [...root.querySelectorAll<HTMLElement>('[data-help-item]')];
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  const index = active ? items.indexOf(active) : -1;
  if (index === -1 && event.key === 'ArrowUp') return;
  event.preventDefault();
  if (index === -1) items[0].focus();
  else if (event.key === 'ArrowDown') items[Math.min(items.length - 1, index + 1)].focus();
  else if (index === 0) root.querySelector<HTMLElement>('[data-help-field]')?.focus();
  else items[index - 1].focus();
}

interface TopicRowProps {
  title: string;
  hint?: string;
  snippet?: { text: string; ranges: { start: number; end: number }[]; cutStart: boolean; cutEnd: boolean } | null;
  titleRanges?: { start: number; end: number }[];
  onOpen: () => void;
}

function TopicRow({ title, hint, snippet, titleRanges = [], onOpen }: TopicRowProps) {
  return (
    <li>
      <button type="button" className="help__item" data-help-item onClick={onOpen}>
        <span className="help__item-title">
          <Highlighted text={title} ranges={titleRanges} />
        </span>
        {hint && <span className="help__item-hint">{hint}</span>}
        {snippet && (
          <span className="help__item-snippet">
            {snippet.cutStart && '… '}
            <Highlighted text={snippet.text} ranges={snippet.ranges} />
            {snippet.cutEnd && ' …'}
          </span>
        )}
      </button>
    </li>
  );
}

export function HelpPanel({ route }: { route: Route }) {
  const { t } = useTranslation();
  const help = useHelp();
  const { view } = help;
  const root = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState('');
  const pageName = t(`help.pages.${route.name}`);
  const entries = useHelpEntries();

  // The focus moves into the panel when it opens and when its view changes, and back to the "?" button when it closes.
  useEffect(() => {
    const target = root.current?.querySelector<HTMLElement>('[data-help-focus]');
    target?.focus();
    setNotice('');
  }, [view]);
  useEffect(() => {
    const button = help.buttonRef.current;
    return () => button?.focus();
  }, [help.buttonRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (view.name === 'home') help.closeHelp();
    else help.setView({ name: 'home' });
  };

  const topicTitle = (id: string): string => t(`help.topics.${id}.title`);
  const openTopic = (id: string): void => {
    if (id === TOUR_TOPIC_ID) help.startTour();
    else help.setView({ name: 'topic', id });
  };

  const runShow = (spec: ShowSpec): void => setNotice(help.show(spec) ? t('help.shown') : spec.missing === 'story' ? t('help.missingStory') : t('help.missing'));

  const showButton = (spec: ShowSpec, pages: readonly PageKey[], page: PageKey) =>
    pages.includes(route.name) ? (
      <button type="button" className="btn" onClick={() => runShow(spec)}>
        {t('help.showMe')}
      </button>
    ) : (
      <a className="btn" href={hrefs[page]}>
        {t('help.goTo', { page: t(`help.pages.${page}`) })}
      </a>
    );

  return (
    <aside ref={root} className="help" aria-label={t('help.panelLabel')} onKeyDown={onKeyDown}>
      <div className="help__head">
        <h2 className="help__title">{t('help.title', { page: pageName })}</h2>
        <button type="button" className="icon-btn" onClick={help.closeHelp} aria-label={t('help.close')} title={t('help.close')}>
          <CloseIcon />
        </button>
      </div>
      {view.name === 'home' && <HomeView route={route} entries={entries} openTopic={openTopic} topicTitle={topicTitle} />}
      {view.name === 'topic' && <TopicView id={view.id} route={route} notice={notice} showButton={showButton} />}
      {view.name === 'tour' && <TourView route={route} notice={notice} showButton={showButton} />}
    </aside>
  );
}

function HomeView({
  route,
  entries,
  openTopic,
  topicTitle
}: {
  route: Route;
  entries: ReturnType<typeof useHelpEntries>;
  openTopic: (id: string) => void;
  topicTitle: (id: string) => string;
}) {
  const { t } = useTranslation();
  const help = useHelp();
  const list = useRef<HTMLDivElement>(null);
  const query = help.query;
  const searching = query.trim() !== '';
  const hits = useMemo(() => searchHelp(entries, query), [entries, query]);
  const pageOf = (topic: TopicDef): string | undefined =>
    topic.pages.includes(route.name) || topic.general ? undefined : t('help.topicOn', { page: t(`help.pages.${topic.pages[0]}`) });
  const byId = (id: string): TopicDef | undefined => TOPICS.find((topic) => topic.id === id);

  const here = TOPICS.filter((topic) => !topic.general && topic.pages.includes(route.name));
  const general = TOPICS.filter((topic) => topic.general);
  const progress = doneCount(help.state);

  const row = (topic: TopicDef) => (
    <TopicRow key={topic.id} title={topicTitle(topic.id)} hint={pageOf(topic)} onOpen={() => openTopic(topic.id)} />
  );

  return (
    <div className="help__body" ref={list} onKeyDown={(event) => moveInList(event, list.current)}>
      <div className="help__search">
        <input
          type="search"
          className="input help__field"
          data-help-field
          data-help-focus
          aria-label={t('help.search.label')}
          placeholder={t('help.search.placeholder')}
          value={query}
          onChange={(event) => help.setQuery(event.target.value)}
        />
        {query !== '' && (
          <button
            type="button"
            className="icon-btn help__clear"
            aria-label={t('help.search.clear')}
            title={t('help.search.clear')}
            onClick={() => {
              help.setQuery('');
              list.current?.querySelector<HTMLElement>('[data-help-field]')?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {searching ? (
        <>
          <p className="sr-only" role="status">
            {hits.length === 0 ? t('help.search.none', { query: query.trim() }) : t('help.search.results', { count: hits.length })}
          </p>
          {hits.length === 0 ? (
            <div className="help__none">
              <p>
                <strong>{t('help.search.none', { query: query.trim() })}</strong>
              </p>
              <p className="muted">{t('help.search.noneHint')}</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  help.setQuery('');
                  help.setListAll(true);
                }}
              >
                {t('help.search.showAll')}
              </button>
            </div>
          ) : (
            <ul className="help__list" aria-label={t('help.search.resultsLabel')}>
              {hits.map((hit) => (
                <TopicRow
                  key={hit.id}
                  title={topicTitle(hit.id)}
                  titleRanges={hit.titleRanges}
                  hint={hit.id === TOUR_TOPIC_ID ? undefined : byId(hit.id) && pageOf(byId(hit.id) as TopicDef)}
                  snippet={hit.titleRanges.length === 0 ? hit.snippet : null}
                  onOpen={() => openTopic(hit.id)}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <button type="button" className="help__tour" data-help-item onClick={help.startTour}>
            <span className="help__tour-title">{t('help.tour.title')}</span>
            <span className="help__tour-state">
              {help.state.tourStarted ? t('help.tour.progressShort', { done: progress, total: TOUR_STEPS.length }) : t('help.tour.open')}
            </span>
          </button>
          {help.listAll ? (
            <>
              <h3 className="help__heading">{t('help.allTopics')}</h3>
              <ul className="help__list">{TOPICS.map(row)}</ul>
            </>
          ) : (
            <>
              {here.length > 0 && (
                <>
                  <h3 className="help__heading">{t('help.onThisPage')}</h3>
                  <ul className="help__list">{here.map(row)}</ul>
                </>
              )}
              <h3 className="help__heading">{t('help.general')}</h3>
              <ul className="help__list">{general.map(row)}</ul>
              <button type="button" className="btn help__all" onClick={() => help.setListAll(true)}>
                {t('help.allTopics')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function BackButton() {
  const { t } = useTranslation();
  const help = useHelp();
  return (
    <button type="button" className="btn help__back" onClick={() => help.setView({ name: 'home' })}>
      ← {t('help.back')}
    </button>
  );
}

function TopicView({
  id,
  route,
  notice,
  showButton
}: {
  id: string;
  route: Route;
  notice: string;
  showButton: (spec: ShowSpec, pages: readonly PageKey[], page: PageKey) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const topic = TOPICS.find((item) => item.id === id);
  const paragraphs = t(`help.topics.${id}.body`).split('\n');
  return (
    <div className="help__body">
      <BackButton />
      <h3 className="help__topic" tabIndex={-1} data-help-focus>
        {t(`help.topics.${id}.title`)}
      </h3>
      {paragraphs.map((text, index) => (
        <p key={index}>{text}</p>
      ))}
      {topic?.show && (
        <div className="help__actions">{showButton(topic.show, topic.pages, topic.pages.includes(route.name) ? route.name : topic.pages[0])}</div>
      )}
      <p className="help__notice muted" role="status">
        {notice}
      </p>
    </div>
  );
}

function TourView({
  route,
  notice,
  showButton
}: {
  route: Route;
  notice: string;
  showButton: (spec: ShowSpec, pages: readonly PageKey[], page: PageKey) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const help = useHelp();
  const [confirming, setConfirming] = useState(false);
  const current = activeStep(help.state);
  const body = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // When the user finishes a step in the panel, its button is gone: the focus goes on to the next step instead of
  // getting lost. A step that the app ticks off while the user works on the page does not take the focus away.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const element = body.current;
    const active = document.activeElement;
    if (!element || (active && active !== document.body && !element.contains(active))) return;
    const next = element.querySelector<HTMLElement>('[aria-current="step"] button, [aria-current="step"] a');
    (next ?? element.querySelector<HTMLElement>('[data-help-focus]'))?.focus();
  }, [current]);
  const done = doneCount(help.state);
  const stepText = (id: TourStepId, part: 'title' | 'text'): string => t(`help.tour.steps.${id}.${part}`);

  return (
    <div className="help__body" ref={body}>
      <BackButton />
      <h3 className="help__topic" tabIndex={-1} data-help-focus>
        {t('help.tour.title')}
      </h3>
      <p className="muted">{t('help.tour.intro')}</p>
      <div className="help__progress" aria-hidden="true">
        <i style={{ width: `${(done / TOUR_STEPS.length) * 100}%` }} />
      </div>
      <p className="help__count" role="status">
        {t('help.tour.progress', { done, total: TOUR_STEPS.length })}
      </p>
      <ol className="help__steps" aria-label={t('help.tour.stepsLabel')}>
        {TOUR_STEPS.map((id) => {
          const result = help.state.steps[id];
          const active = id === current;
          const view = TOUR_STEP_VIEW[id];
          return (
            <li key={id} className={`help__step${active ? ' help__step--current' : ''}${result ? ` help__step--${result}` : ''}`} aria-current={active ? 'step' : undefined}>
              <span className="help__mark" aria-hidden="true">
                {result === 'done' ? '✓' : result === 'skipped' ? '–' : ''}
              </span>
              <div className="help__step-body">
                <strong>{stepText(id, 'title')}</strong>
                {result && <span className="help__step-state"> · {result === 'done' ? t('help.tour.stepDone') : t('help.tour.stepSkipped')}</span>}
                {active && (
                  <>
                    <p>{stepText(id, 'text')}</p>
                    <div className="help__actions">
                      {id === 'board' ? (
                        <button type="button" className="btn btn--primary" onClick={() => help.confirmStep(id)}>
                          {t('help.tour.confirm')}
                        </button>
                      ) : (
                        showButton(view.show, view.pages, view.pages.includes(route.name) ? route.name : pageOfStep(id))
                      )}
                      <button type="button" className="btn" onClick={() => help.skipStep(id)}>
                        {t('help.tour.skip')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="help__notice muted" role="status">
        {notice}
      </p>
      {current === null && <p className="help__finished">{t('help.tour.finished')}</p>}
      <div className="help__actions help__actions--foot">
        <button type="button" className="btn" onClick={help.closeHelp}>
          {t('help.tour.close')}
        </button>
        {!confirming && (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>
            {t('help.tour.restart')}
          </button>
        )}
      </div>
      {confirming && (
        <div className="help__confirm" role="group" aria-label={t('help.tour.restart')}>
          <p>{t('help.tour.restartAsk')}</p>
          <div className="help__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                help.restartTour();
                setConfirming(false);
              }}
            >
              {t('help.tour.restartYes')}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              {t('help.tour.restartNo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
