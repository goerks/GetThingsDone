import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Repository } from '../data/repository';
import { seedSnapshot } from '../data/seed';
import {
  addCriterion as addCriterionTo,
  changedPositions,
  createStory as createStoryIn,
  dropStory,
  moveInBacklog,
  setInSprint,
  toggleCriterion as toggleCriterionIn,
  type NewStoryInput
} from '../domain/board';
import { newId } from '../domain/ids';
import type { Epic, Snapshot, Story } from '../domain/types';

interface AppApi {
  epics: Epic[];
  stories: Story[];
  loading: boolean;
  error: string | null;
  drop(activeId: string, overId: string): void;
  moveInBacklog(id: string, delta: -1 | 1): void;
  toggleSprint(id: string): void;
  toggleCriterion(storyId: string, criterionId: string): void;
  addCriterion(storyId: string, text: string): void;
  createStory(input: NewStoryInput): string;
}

const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

interface Props {
  repository: Promise<Repository> | Repository;
  children: ReactNode;
}

export function AppProvider({ repository, children }: Props) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<Snapshot>({ epics: [], stories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const repoRef = useRef<Repository | null>(null);
  const storiesRef = useRef<Story[]>([]);

  const update = useCallback((stories: Story[]) => {
    storiesRef.current = stories;
    setSnapshot((current) => ({ ...current, stories }));
  }, []);

  // Writes run one after another so a quick series of changes is stored in the order it happened.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback(
    (work: (repo: Repository) => Promise<void>) => {
      const repo = repoRef.current;
      if (!repo) return;
      queueRef.current = queueRef.current
        .then(() => work(repo))
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : String(cause);
          setError(t('state.saveFailed', { message }));
        });
    },
    [t]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = await repository;
        repoRef.current = repo;
        let loaded = await repo.load();
        if (loaded.epics.length === 0 && loaded.stories.length === 0) {
          loaded = seedSnapshot();
          await repo.replaceAll(loaded);
        }
        if (cancelled) return;
        storiesRef.current = loaded.stories;
        setSnapshot(loaded);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (!cancelled) setError(t('state.loadFailed', { message }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // The repository is created once at start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo<AppApi>(
    () => ({
      epics: snapshot.epics,
      stories: snapshot.stories,
      loading,
      error,
      drop(activeId, overId) {
        const before = storiesRef.current;
        const after = dropStory(before, activeId, overId);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      moveInBacklog(id, delta) {
        const before = storiesRef.current;
        const after = moveInBacklog(before, id, delta);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      toggleSprint(id) {
        const story = storiesRef.current.find((item) => item.id === id);
        if (!story) return;
        const value = !story.inSprint;
        update(setInSprint(storiesRef.current, id, value));
        persist((repo) => repo.setInSprint(id, value));
      },
      toggleCriterion(storyId, criterionId) {
        const before = storiesRef.current;
        const story = before.find((item) => item.id === storyId);
        const criterion = story?.criteria.find((item) => item.id === criterionId);
        if (!criterion) return;
        update(toggleCriterionIn(before, storyId, criterionId));
        persist((repo) => repo.setCriterionDone(criterionId, !criterion.done));
      },
      addCriterion(storyId, text) {
        const trimmed = text.trim();
        const before = storiesRef.current;
        const story = before.find((item) => item.id === storyId);
        if (!story || !trimmed) return;
        const id = newId();
        const position = story.criteria.length;
        update(addCriterionTo(before, storyId, id, trimmed));
        persist((repo) => repo.addCriterion(storyId, { id, text: trimmed, done: false }, position));
      },
      createStory(input) {
        const id = newId();
        const result = createStoryIn(storiesRef.current, input, id);
        update(result.stories);
        persist((repo) => repo.addStory(result.story));
        return id;
      }
    }),
    [snapshot, loading, error, update, persist]
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
