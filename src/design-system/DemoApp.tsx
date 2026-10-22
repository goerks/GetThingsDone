import { useMemo, type ReactNode } from 'react';
import { DndContext } from '@dnd-kit/core';
import { LocalStorageRepository } from '../data/localStorageRepository';
import { seedSnapshot } from '../data/seed';
import { todayIso } from '../domain/sprints';
import { AppProvider, useApp } from '../state/AppState';
import { DetailsProvider } from '../state/Details';
import { HelpProvider } from '../state/Help';
import { SearchProvider } from '../state/Search';
import { StoryMenuProvider } from '../state/StoryMenu';
import { ToastProvider } from '../state/Toast';

/** The demo data of the preview in an own browser store, so the catalogue shows the real components with real data. */
function demoRepository(): Promise<LocalStorageRepository> {
  const repository = new LocalStorageRepository();
  return repository.replaceAll(seedSnapshot(todayIso())).then(() => repository);
}

function Ready({ children }: { children: ReactNode }) {
  const { loading } = useApp();
  return loading ? <p className="muted">…</p> : <>{children}</>;
}

/** The providers of the app around a story, fed with the demo data. */
export function DemoApp({ children }: { children: ReactNode }) {
  const repository = useMemo(demoRepository, []);
  return (
    <ToastProvider>
      <AppProvider repository={repository}>
        <DetailsProvider>
          <StoryMenuProvider>
            <SearchProvider>
              <HelpProvider>
                <DndContext>
                  <Ready>{children}</Ready>
                </DndContext>
              </HelpProvider>
            </SearchProvider>
          </StoryMenuProvider>
        </DetailsProvider>
      </AppProvider>
    </ToastProvider>
  );
}
