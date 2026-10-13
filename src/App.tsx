import { featureOn } from './domain/settings';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { createRepository } from './data/createRepository';
import type { Repository } from './data/repository';
import { BacklogPage } from './pages/BacklogPage';
import { BoardPage } from './pages/BoardPage';
import { EpicsPage } from './pages/EpicsPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { SettingsPage } from './pages/SettingsPage';
import { MapPage } from './pages/MapPage';
import { hrefs, useRoute } from './router';
import { AppProvider, useApp } from './state/AppState';
import { DetailsProvider } from './state/Details';
import { SearchProvider } from './state/Search';
import { useTheme } from './theme';

function Shell() {
  const { t } = useTranslation();
  const route = useRoute();
  const { theme, toggleTheme } = useTheme();
  const { loading, error, settings } = useApp();
  // Without releases the address of the Releases page leads back to the board.
  const hidden = route.name === 'releases' && !loading && !featureOn(settings, 'releases');
  useEffect(() => {
    if (hidden) window.location.replace(hrefs.board);
  }, [hidden]);

  return (
    <div className="app">
      <Header route={route} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main">
        {error && (
          <div role="alert" className="notice notice--error">
            {error}
          </div>
        )}
        {loading ? (
          <p className="muted" role="status">
            {t('state.loading')}
          </p>
        ) : route.name === 'backlog' ? (
          <BacklogPage />
        ) : route.name === 'map' ? (
          <MapPage />
        ) : route.name === 'epics' ? (
          <EpicsPage />
        ) : route.name === 'releases' && !hidden ? (
          <ReleasesPage />
        ) : route.name === 'settings' ? (
          <SettingsPage section={route.section} />
        ) : (
          <BoardPage />
        )}
      </main>
    </div>
  );
}

export default function App({ repository }: { repository?: Promise<Repository> | Repository }) {
  const source = useMemo(() => repository ?? createRepository(), [repository]);
  return (
    <AppProvider repository={source}>
      <DetailsProvider>
        <SearchProvider>
          <Shell />
        </SearchProvider>
      </DetailsProvider>
    </AppProvider>
  );
}
