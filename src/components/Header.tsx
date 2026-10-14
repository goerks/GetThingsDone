import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n';
import { hrefs, type Route } from '../router';
import type { Theme } from '../theme';
import { GearIcon, KeyboardIcon } from './icons';
import { useFeature } from './useFeature';
import { useHelp } from '../state/Help';
import { RECORDER_ATTR } from '../state/recorderDom';
import { useRecorder } from '../state/Recorder';
import { SearchBox } from './search/SearchBox';

interface Props {
  route: Route;
  theme: Theme;
  onToggleTheme: () => void;
  /** Opens the overview of the keyboard shortcuts. */
  onShowShortcuts: () => void;
}

export function Header({ route, theme, onToggleTheme, onShowShortcuts }: Props) {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? 'en') as LanguageCode;
  const dark = theme === 'dark';
  const releasesEnabled = useFeature('releases');
  const help = useHelp();
  const recorder = useRecorder();
  const inSettings = route.name === 'settings';
  // The gear opens the settings; pressed again, it goes back to the page shown before.
  const lastView = useRef<string>(hrefs.board);
  if (!inSettings) lastView.current = hrefs[route.name];

  // Escape closes the settings and goes back to the page shown before, like the gear. The help closes first: it is
  // checked through a ref, because it closes in the same key press. A field or search that uses Escape itself comes first.
  const helpOpen = useRef(help.open);
  helpOpen.current = help.open;
  useEffect(() => {
    if (!inSettings) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || helpOpen.current) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      window.location.hash = lastView.current;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inSettings]);

  const headerRef = useRef<HTMLElement>(null);
  // The header wraps on narrow screens, so its height is measured and shared as `--header-height`.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const share = (): void => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    share();
    const observer = new ResizeObserver(share);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-height');
    };
  }, []);

  return (
    <header className="header" ref={headerRef}>
      <div className="brand">
        <span className="brand__logo" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
        </span>
        <strong>{t('app.name')}</strong>
      </div>

      <nav className="nav" aria-label={t('nav.main')}>
        <a href={hrefs.board} className="nav__link" aria-current={route.name === 'board' ? 'page' : undefined}>
          {t('nav.board')}
        </a>
        <a href={hrefs.backlog} className="nav__link" aria-current={route.name === 'backlog' ? 'page' : undefined}>
          {t('nav.backlog')}
        </a>
        <a href={hrefs.map} className="nav__link" aria-current={route.name === 'map' ? 'page' : undefined}>
          {t('nav.storyMap')}
        </a>
        <a href={hrefs.epics} className="nav__link" aria-current={route.name === 'epics' ? 'page' : undefined}>
          {t('nav.epics')}
        </a>
        {releasesEnabled && (
          <a href={hrefs.releases} className="nav__link" aria-current={route.name === 'releases' ? 'page' : undefined}>
            {t('nav.releases')}
          </a>
        )}
      </nav>

      <div className="header__tools">
        <SearchBox />
        <button
          type="button"
          className="icon-btn"
          onClick={onShowShortcuts}
          aria-label={t('header.shortcuts')}
          title={t('header.shortcuts')}
          aria-keyshortcuts="Control+/ Meta+/"
        >
          <KeyboardIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={dark ? t('header.toLight') : t('header.toDark')}
          title={dark ? t('header.toLight') : t('header.toDark')}
        >
          {dark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
        <select
          className="select"
          aria-label={t('header.language')}
          value={language}
          onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        >
          {LANGUAGES.map((item) => (
            <option key={item.code} value={item.code} lang={item.code}>
              {item.label}
            </option>
          ))}
        </select>
        <a
          href={inSettings ? lastView.current : hrefs.settings}
          className="icon-btn header__settings"
          aria-label={inSettings ? t('nav.closeSettings') : t('nav.settings')}
          title={inSettings ? t('nav.closeSettings') : t('nav.settings')}
          aria-current={inSettings ? 'page' : undefined}
        >
          <GearIcon />
        </a>
        {recorder.enabled && (
          <button
            type="button"
            ref={recorder.buttonRef}
            {...{ [RECORDER_ATTR]: 'true' }}
            className={`btn recorder-btn${recorder.state.draft ? ' recorder-btn--live' : ''}${recorder.panel === 'open' ? ' icon-btn--on' : ''}`}
            aria-expanded={recorder.panel === 'open'}
            onClick={recorder.togglePanel}
          >
            <span className="recorder-btn__dot" aria-hidden="true" />
            {t('recorder.button')}
          </button>
        )}
        <button
          type="button"
          ref={help.buttonRef}
          className={`icon-btn help-btn${help.open ? ' icon-btn--on' : ''}`}
          aria-label={t('help.button')}
          title={t('help.button')}
          aria-expanded={help.open}
          aria-keyshortcuts="?"
          onClick={help.toggleHelp}
        >
          <span aria-hidden="true">?</span>
        </button>
      </div>
    </header>
  );
}
