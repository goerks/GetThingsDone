import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { EpicDialog } from '../components/EpicDialog';
import { ReleaseDialog } from '../components/ReleaseDialog';
import { SprintDialog } from '../components/SprintDialog';
import { StoryDialog } from '../components/StoryDialog';
import { useApp } from './AppState';
import { DetailNavContext, type DetailNav } from './detailNav';

export type DetailKind = 'story' | 'epic' | 'sprint' | 'release';

interface Detail {
  kind: DetailKind;
  id: string;
  nav: DetailNav | null;
}

interface DetailsApi {
  /** The item whose dialog is open, or null. */
  current: { kind: DetailKind; id: string } | null;
  openStory(id: string): void;
  openEpic(id: string): void;
  openSprint(id: string): void;
  openRelease(id: string): void;
  open(kind: DetailKind, id: string, nav?: DetailNav): void;
  close(): void;
}

const DetailsContext = createContext<DetailsApi | null>(null);

/** The same context for components that also render outside the provider (they then stay plain). */
export const DetailsContextForTag = DetailsContext;

/** Opens stories, epics, sprints and releases in a dialog over the current page. */
export function useDetails(): DetailsApi {
  const value = useContext(DetailsContext);
  if (!value) throw new Error('useDetails must be used inside DetailsProvider');
  return value;
}

export function DetailsProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const [detail, setDetail] = useState<Detail | null>(null);
  const current = useMemo(() => (detail ? { kind: detail.kind, id: detail.id } : null), [detail?.kind, detail?.id]);
  const api = useMemo<DetailsApi>(
    () => ({
      current,
      openStory: (id) => setDetail({ kind: 'story', id, nav: null }),
      openEpic: (id) => setDetail({ kind: 'epic', id, nav: null }),
      openSprint: (id) => setDetail({ kind: 'sprint', id, nav: null }),
      openRelease: (id) => setDetail({ kind: 'release', id, nav: null }),
      open: (kind, id, nav) => setDetail({ kind, id, nav: nav ?? null }),
      close: () => setDetail(null)
    }),
    [current]
  );
  const close = (): void => setDetail(null);
  const sprint = detail?.kind === 'sprint' ? app.sprints.find((item) => item.id === detail.id) : undefined;

  return (
    <DetailsContext.Provider value={api}>
      {children}
      {/* The key gives each opened item a fresh dialog, so focus and drafts never leak between items. */}
      <DetailNavContext.Provider value={detail?.nav ?? null}>
        {detail?.kind === 'story' && <StoryDialog key={detail.id} id={detail.id} onClose={close} />}
        {detail?.kind === 'epic' && <EpicDialog key={detail.id} id={detail.id} onClose={close} />}
        {sprint && <SprintDialog key={sprint.id} sprint={sprint} onClose={close} />}
        {detail?.kind === 'release' && (
          <ReleaseDialog key={detail.id} id={detail.id} onClose={close} onOpenStory={(storyId) => setDetail({ kind: 'story', id: storyId, nav: null })} />
        )}
      </DetailNavContext.Provider>
    </DetailsContext.Provider>
  );
}
