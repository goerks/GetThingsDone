import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Repository } from '../data/repository';
import { seedSnapshot } from '../data/seed';
import {
  addCriterion as addCriterionTo,
  changedPositions,
  createStory as createStoryIn,
  deleteCriterion as deleteCriterionIn,
  deleteStory as deleteStoryIn,
  dropInBacklog,
  dropOnMap,
  dropStory,
  moveCriterion as moveCriterionIn,
  toggleCriterion as toggleCriterionIn,
  updateCriterionText,
  updateStory as updateStoryIn,
  type NewStoryInput,
  type Placement,
  type StoryPatch
} from '../domain/board';
import {
  createEpic as createEpicIn,
  deleteEpic as deleteEpicIn,
  storiesInEpic,
  updateEpic as updateEpicIn,
  type EpicPatch,
  type NewEpicInput
} from '../domain/epics';
import {
  createField as createFieldIn,
  deleteField as deleteFieldIn,
  dropRemovedOptions,
  moveInLayout,
  setAssigned,
  setItemValue,
  updateLayout,
  updateField as updateFieldIn,
  withoutField,
  type FieldInput,
  type FieldPatch,
  type LayoutPatch
} from '../domain/fields';
import { newId } from '../domain/ids';
import {
  createSprint as createSprintIn,
  moveSprint as moveSprintIn,
  todayIso,
  updateSprint as updateSprintIn,
  type SprintInput
} from '../domain/sprints';
import type { Epic, FieldAssignment, FieldDefinition, FieldValue, ItemType, Snapshot, Sprint, Story } from '../domain/types';

interface AppApi {
  epics: Epic[];
  sprints: Sprint[];
  stories: Story[];
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
  loading: boolean;
  error: string | null;
  /** Drag and drop on the board. */
  drop(activeId: string, overId: string, placement?: Placement): void;
  /** Drag and drop in the backlog, including between sprint sections. */
  dropInBacklog(activeId: string, overId: string, placement?: Placement): void;
  /** Drag and drop on the story map: changes sprint and epic. */
  dropOnMap(activeId: string, overId: string, placement?: Placement): void;
  /** Returns the id of the new sprint, or null when the input is invalid. */
  createSprint(input: SprintInput): string | null;
  updateSprint(id: string, input: SprintInput): void;
  /** Moves an upcoming sprint before or after another one; the dates of the upcoming sprints are recalculated. */
  moveSprint(activeId: string, overId: string, placement: Placement): void;
  createStory(input: NewStoryInput): string;
  updateStory(id: string, patch: StoryPatch): void;
  deleteStory(id: string): void;
  toggleCriterion(storyId: string, criterionId: string): void;
  addCriterion(storyId: string, text: string): void;
  editCriterion(storyId: string, criterionId: string, text: string): void;
  deleteCriterion(storyId: string, criterionId: string): void;
  moveCriterion(storyId: string, activeId: string, overId: string): void;
  /** Returns the id of the new epic, or null when the name is empty. */
  createEpic(input: NewEpicInput): string | null;
  updateEpic(id: string, patch: EpicPatch): void;
  /** Returns false when the epic still has stories and was kept. */
  deleteEpic(id: string): boolean;
  /** Returns the id of the new field, or null when the input is invalid. */
  createField(input: FieldInput): string | null;
  /** Changes label and options of a custom field. Returns false when the input is invalid. */
  updateField(id: string, input: FieldPatch): boolean;
  deleteField(id: string): void;
  /** Uses a custom field on an item type or stops using it there; values are kept. */
  setFieldUsed(fieldId: string, itemType: ItemType, used: boolean): void;
  /** Moves a custom field before or after another one in the layout of an item type. */
  moveFieldInLayout(itemType: ItemType, activeId: string, overId: string): void;
  /** Changes required, on card and in create dialog of a field on an item type. Returns false when refused. */
  updateFieldLayout(itemType: ItemType, fieldId: string, patch: LayoutPatch): boolean;
  /** Sets or clears (null) the value of a custom field on a story or an epic. */
  setFieldValue(itemId: string, fieldId: string, value: FieldValue | null): void;
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
  const [snapshot, setSnapshot] = useState<Snapshot>({ epics: [], sprints: [], stories: [], fields: [], assignments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const repoRef = useRef<Repository | null>(null);
  const storiesRef = useRef<Story[]>([]);
  const epicsRef = useRef<Epic[]>([]);
  const sprintsRef = useRef<Sprint[]>([]);
  const fieldsRef = useRef<Pick<Snapshot, 'fields' | 'assignments'>>({ fields: [], assignments: [] });

  const update = useCallback((stories: Story[]) => {
    storiesRef.current = stories;
    setSnapshot((current) => ({ ...current, stories }));
  }, []);

  const updateEpics = useCallback((epics: Epic[]) => {
    epicsRef.current = epics;
    setSnapshot((current) => ({ ...current, epics }));
  }, []);

  const updateSprints = useCallback((sprints: Sprint[]) => {
    sprintsRef.current = sprints;
    setSnapshot((current) => ({ ...current, sprints }));
  }, []);

  const updateFields = useCallback((fields: FieldDefinition[], assignments: FieldAssignment[]) => {
    fieldsRef.current = { fields, assignments };
    setSnapshot((current) => ({ ...current, fields, assignments }));
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
          loaded = seedSnapshot(todayIso());
          await repo.replaceAll(loaded);
        }
        if (cancelled) return;
        storiesRef.current = loaded.stories;
        epicsRef.current = loaded.epics;
        fieldsRef.current = { fields: loaded.fields, assignments: loaded.assignments };
        sprintsRef.current = loaded.sprints;
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
      sprints: snapshot.sprints,
      stories: snapshot.stories,
      fields: snapshot.fields,
      assignments: snapshot.assignments,
      loading,
      error,
      drop(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropStory(before, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      dropInBacklog(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropInBacklog(before, sprintsRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      dropOnMap(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropOnMap(before, sprintsRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      createSprint(input) {
        const id = newId();
        const result = createSprintIn(sprintsRef.current, input, id);
        if (!result) return null;
        updateSprints(result.sprints);
        persist((repo) => repo.addSprint(result.sprint));
        return id;
      },
      moveSprint(activeId, overId, placement) {
        const before = sprintsRef.current;
        const after = moveSprintIn(before, todayIso(), activeId, overId, placement);
        if (after === before) return;
        updateSprints(after);
        const changed = after.filter((sprint, index) => sprint !== before[index]);
        persist(async (repo) => {
          for (const sprint of changed) await repo.updateSprint(sprint);
        });
      },
      updateSprint(id, input) {
        const after = updateSprintIn(sprintsRef.current, id, input);
        const sprint = after.find((item) => item.id === id);
        if (after === sprintsRef.current || !sprint) return;
        updateSprints(after);
        persist((repo) => repo.updateSprint(sprint));
      },
      createStory(input) {
        const id = newId();
        const result = createStoryIn(storiesRef.current, input, id);
        update(result.stories);
        persist((repo) => repo.addStory(result.story));
        return id;
      },
      updateStory(id, patch) {
        const after = updateStoryIn(storiesRef.current, id, patch);
        const story = after.find((item) => item.id === id);
        if (!story) return;
        update(after);
        persist((repo) => repo.updateStory(story));
      },
      deleteStory(id) {
        update(deleteStoryIn(storiesRef.current, id));
        persist((repo) => repo.deleteStory(id));
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
      editCriterion(storyId, criterionId, text) {
        const trimmed = text.trim();
        if (!trimmed) return;
        update(updateCriterionText(storiesRef.current, storyId, criterionId, trimmed));
        persist((repo) => repo.setCriterionText(criterionId, trimmed));
      },
      deleteCriterion(storyId, criterionId) {
        update(deleteCriterionIn(storiesRef.current, storyId, criterionId));
        persist((repo) => repo.deleteCriterion(criterionId));
      },
      moveCriterion(storyId, activeId, overId) {
        const after = moveCriterionIn(storiesRef.current, storyId, activeId, overId);
        const story = after.find((item) => item.id === storyId);
        if (!story) return;
        update(after);
        const order = story.criteria.map((criterion) => criterion.id);
        persist((repo) => repo.saveCriteriaOrder(storyId, order));
      },
      createEpic(input) {
        const id = newId();
        const result = createEpicIn(epicsRef.current, input, id);
        if (!result) return null;
        updateEpics(result.epics);
        persist((repo) => repo.addEpic(result.epic));
        return id;
      },
      updateEpic(id, patch) {
        const after = updateEpicIn(epicsRef.current, id, patch);
        const epic = after.find((item) => item.id === id);
        if (!epic) return;
        updateEpics(after);
        persist((repo) => repo.updateEpic(epic));
      },
      deleteEpic(id) {
        if (storiesInEpic(storiesRef.current, id) > 0) return false;
        updateEpics(deleteEpicIn(epicsRef.current, storiesRef.current, id));
        persist((repo) => repo.deleteEpic(id));
        return true;
      },
      createField(input) {
        const { fields, assignments } = fieldsRef.current;
        const result = createFieldIn(fields, assignments, input, newId);
        if (!result) return null;
        updateFields(result.fields, result.assignments);
        const own = result.assignments.filter((item) => item.fieldId === result.field.id);
        persist(async (repo) => {
          await repo.saveField(result.field);
          await repo.saveAssignments(result.field.id, own);
        });
        return result.field.id;
      },
      updateField(id, input) {
        const { fields, assignments } = fieldsRef.current;
        const result = updateFieldIn(fields, id, input, newId);
        if (!result) return false;
        updateFields(result.fields, assignments);
        update(dropRemovedOptions(storiesRef.current, result.field));
        updateEpics(dropRemovedOptions(epicsRef.current, result.field));
        persist((repo) => repo.saveField(result.field));
        return true;
      },
      deleteField(id) {
        const { fields, assignments } = fieldsRef.current;
        const result = deleteFieldIn(fields, assignments, id);
        if (!result) return;
        updateFields(result.fields, result.assignments);
        update(withoutField(storiesRef.current, id));
        updateEpics(withoutField(epicsRef.current, id));
        persist((repo) => repo.deleteField(id));
      },
      setFieldUsed(fieldId, itemType, used) {
        const { fields, assignments } = fieldsRef.current;
        const after = setAssigned(fields, assignments, fieldId, itemType, used);
        if (!after) return;
        updateFields(fields, after);
        const own = after.filter((item) => item.fieldId === fieldId);
        persist((repo) => repo.saveAssignments(fieldId, own));
      },
      moveFieldInLayout(itemType, activeId, overId) {
        const { fields, assignments } = fieldsRef.current;
        const after = moveInLayout(itemType, fields, assignments, activeId, overId);
        const changed = after.filter((item, index) => item.position !== assignments[index].position).map((item) => item.fieldId);
        if (changed.length === 0) return;
        updateFields(fields, after);
        persist(async (repo) => {
          for (const fieldId of new Set(changed)) {
            await repo.saveAssignments(fieldId, after.filter((item) => item.fieldId === fieldId));
          }
        });
      },
      updateFieldLayout(itemType, fieldId, patch) {
        const { fields, assignments } = fieldsRef.current;
        const after = updateLayout(itemType, fields, assignments, fieldId, patch);
        if (!after) return false;
        updateFields(fields, after);
        persist((repo) => repo.saveAssignments(fieldId, after.filter((item) => item.fieldId === fieldId)));
        return true;
      },
      setFieldValue(itemId, fieldId, value) {
        if (storiesRef.current.some((story) => story.id === itemId)) update(setItemValue(storiesRef.current, itemId, fieldId, value));
        else updateEpics(setItemValue(epicsRef.current, itemId, fieldId, value));
        persist((repo) => repo.setFieldValue(itemId, fieldId, value));
      }
    }),
    [snapshot, loading, error, update, updateEpics, updateSprints, updateFields, persist]
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
