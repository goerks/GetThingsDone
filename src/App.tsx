import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { createRepository } from './data/createRepository';
import type { Repository } from './data/repository';
import { BacklogPage } from './pages/BacklogPage';
import { BoardPage } from './pages/BoardPage';
import { EpicsPage } from './pages/EpicsPage';
import { FieldsPage } from './pages/FieldsPage';
import { MapPage } from './pages/MapPage';
import { useRoute } from './router';
import { AppProvider, useApp } from './state/AppState';
import { DetailsProvider } from './state/Details';
import { useTheme } from './theme';

function Shell() {
  const { t } = useTranslation();
  const route = useRoute();
  const { theme, toggleTheme } = useTheme();
  const { loading, error } = useApp();

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
        ) : route.name === 'fields' ? (
          <FieldsPage />
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
        <Shell />
      </DetailsProvider>
    </AppProvider>
  );
}
