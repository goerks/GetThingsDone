import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n';
import { hrefs, type Route } from '../router';
import type { Theme } from '../theme';

interface Props {
  route: Route;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ route, theme, onToggleTheme }: Props) {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? 'en') as LanguageCode;
  const dark = theme === 'dark';

  return (
    <header className="header">
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
        <span className="nav__link nav__link--disabled">
          {t('nav.storyMap')}
          <span className="badge" aria-hidden="true">
            {t('nav.release2')}
          </span>
          <span className="sr-only">: {t('nav.storyMapNote')}</span>
        </span>
      </nav>

      <div className="header__tools">
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
      </div>
    </header>
  );
}
