import { featureOn } from './domain/settings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AcceptancePanel } from './acceptance/Panel';
import { acceptanceEnabled } from './acceptance/preview';
import { Header } from './components/Header';
import { HelpPanel } from './components/help/HelpPanel';
import { WelcomeCard } from './components/help/WelcomeCard';
import { ShortcutsDialog, useShortcutsKey } from './components/Shortcuts';
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
import { HelpProvider, useHelp } from './state/Help';
import { DetailsProvider } from './state/Details';
import { StoryMenuProvider } from './state/StoryMenu';
import { ToastProvider } from './state/Toast';
import { SearchProvider } from './state/Search';
import { useTheme } from './theme';

function Shell() {
  const { t } = useTranslation();
  const route = useRoute();
  const { theme, toggleTheme } = useTheme();
  const { loading, error, settings, flashed, flashScroll } = useApp();
  const help = useHelp();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const openShortcuts = useCallback(() => setShowShortcuts(true), []);
  useShortcutsKey(openShortcuts);

  // A story that was just created or moved by a menu scrolls into view (after a drag it is already where the user looks,
  // and a scroll would disturb the next keyboard drag); with "reduce motion" it jumps instead of gliding.
  useEffect(() => {
    if (!flashed || !flashScroll) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector(`[data-story-id="${flashed}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [flashed, flashScroll]);
  // Without releases the address of the Releases page leads back to the board.
  const hidden = route.name === 'releases' && !loading && !featureOn(settings, 'releases');
  useEffect(() => {
    if (hidden) window.location.replace(hrefs.board);
  }, [hidden]);

  return (
    <div className={`app${help.open ? ' app--help' : ''}`}>
      <Header route={route} theme={theme} onToggleTheme={toggleTheme} onShowShortcuts={openShortcuts} />
      <main className="main">
        {/* The settings are no place for an invitation: they are a task of their own. */}
        {!loading && route.name !== 'settings' && <WelcomeCard />}
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
      {help.open && <HelpPanel route={route} />}
      {showShortcuts && <ShortcutsDialog route={route} onClose={() => setShowShortcuts(false)} />}
      {acceptanceEnabled() && <AcceptancePanel />}
    </div>
  );
}

export default function App({ repository }: { repository?: Promise<Repository> | Repository }) {
  const source = useMemo(() => repository ?? createRepository(), [repository]);
  return (
    <ToastProvider>
      <AppProvider repository={source}>
        <DetailsProvider>
          <StoryMenuProvider>
            <SearchProvider>
              <HelpProvider>
                <Shell />
              </HelpProvider>
            </SearchProvider>
          </StoryMenuProvider>
        </DetailsProvider>
      </AppProvider>
    </ToastProvider>
  );
}
