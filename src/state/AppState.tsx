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
  dropOnReleaseMap,
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
  convertValues,
  createField as createFieldIn,
  deleteField as deleteFieldIn,
  dropRemovedOptions,
  moveInLayout,
  renameBuiltin,
  setAssigned,
  setBuiltinHidden,
  setItemValue,
  updateLayout,
  updateField as updateFieldIn,
  withoutField,
  type FieldInput,
  type FieldPatch,
  type LayoutPatch
} from '../domain/fields';
import type { Activity } from '../domain/helpTour';
import { baselineEvents, releaseEventsFor } from '../domain/history';
import { newId } from '../domain/ids';
import {
  createSprint as createSprintIn,
  moveSprint as moveSprintIn,
  todayIso,
  updateSprint as updateSprintIn,
  type SprintInput
} from '../domain/sprints';
import {
  createRelease as createReleaseIn,
  deleteRelease as deleteReleaseIn,
  updateRelease as updateReleaseIn,
  type ReleaseInput
} from '../domain/releases';
import { DEFAULT_SETTINGS } from '../domain/settings';
import {
  DEFAULT_STATUSES,
  addStatus as addStatusIn,
  isDoneIn,
  removeStatus as removeStatusIn,
  renameStatus as renameStatusIn,
  reorderStatuses,
  repairStatuses,
  startStatus,
  type IsDone,
  type StatusPlace
} from '../domain/statuses';
import type {
  Epic,
  FieldAssignment,
  FieldDefinition,
  FieldValue,
  ItemType,
  FeatureKey,
  MapRows,
  Release,
  ReleaseEvent,
  Settings,
  Snapshot,
  Sprint,
  StatusCategory,
  StatusValue,
  Story
} from '../domain/types';

interface AppApi {
  epics: Epic[];
  sprints: Sprint[];
  releases: Release[];
  /** History of the releases, oldest first (#10). */
  events: ReleaseEvent[];
  stories: Story[];
  /** Status values in board order (#5). */
  statuses: StatusValue[];
  /** Whether a story is done: its status is in the "done" category. */
  isDone: IsDone;
  fields: FieldDefinition[];
  assignments: FieldAssignment[];
  settings: Settings;
  loading: boolean;
  error: string | null;
  /** Calls the listener when the user moves a story to another status, creates a story or orders the backlog. Returns the way to stop listening. */
  onActivity(listener: (activity: Activity) => void): () => void;
  /** Drag and drop on the board. */
  drop(activeId: string, overId: string, placement?: Placement): void;
  /** Drag and drop in the backlog, including between sprint sections. */
  dropInBacklog(activeId: string, overId: string, placement?: Placement): void;
  /** Drag and drop on the story map: changes sprint and epic. */
  dropOnMap(activeId: string, overId: string, placement?: Placement): void;
  /** Drag and drop on the story map with releases as rows: changes release and epic, keeps the sprint. */
  dropOnReleaseMap(activeId: string, overId: string, placement?: Placement): void;
  /** Chooses what the rows of the story map are (a team setting). */
  setMapRows(rows: MapRows): void;
  setFeature(key: FeatureKey, enabled: boolean): void;
  /** Adds a status value at the end of a category. Returns its id, or null when the name is empty. */
  addStatus(category: StatusCategory, label: string): string | null;
  /** Renames a status value; an empty name brings back the translated default of a default value. */
  renameStatus(id: string, label: string): void;
  /** Applies a new order of the status values, possibly with other categories. False when the order is not valid. */
  reorderStatuses(places: readonly StatusPlace[]): boolean;
  /** Removes a status value; its stories get the target status. False when refused. */
  removeStatus(id: string, targetId: string | null): boolean;
  /** Returns the id of the new sprint, or null when the input is invalid. */
  createSprint(input: SprintInput): string | null;
  updateSprint(id: string, input: SprintInput): void;
  /** Moves an upcoming sprint before or after another one; the dates of the upcoming sprints are recalculated. */
  moveSprint(activeId: string, overId: string, placement: Placement): void;
  /** Returns the id of the new release, or null when the input is invalid. */
  createRelease(input: ReleaseInput): string | null;
  /** Changes a release; invalid input is ignored. */
  updateRelease(id: string, input: ReleaseInput): void;
  /** Deletes a release. Its stories stay and lose their release. */
  deleteRelease(id: string): void;
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
  /** Changes label, options, default and (where no value is lost) the type of a custom field. False when refused. */
  updateField(id: string, input: FieldPatch): boolean;
  deleteField(id: string): void;
  /** Uses a custom field on an item type or stops using it there; values are kept. */
  setFieldUsed(fieldId: string, itemType: ItemType, used: boolean): void;
  /** Renames a system or built-in field; null brings back the translated default. */
  renameBuiltinField(fieldId: string, label: string | null): void;
  /** Hides or shows a built-in field on an item type; values stay. */
  setBuiltinFieldHidden(fieldId: string, itemType: ItemType, hidden: boolean): void;
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
  const [snapshot, setSnapshot] = useState<Snapshot>({
    epics: [],
    sprints: [],
    releases: [],
    events: [],
    stories: [],
    statuses: DEFAULT_STATUSES.map((status) => ({ ...status })),
    fields: [],
    assignments: [],
    settings: DEFAULT_SETTINGS
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const repoRef = useRef<Repository | null>(null);
  const storiesRef = useRef<Story[]>([]);
  const epicsRef = useRef<Epic[]>([]);
  const sprintsRef = useRef<Sprint[]>([]);
  const releasesRef = useRef<Release[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const activityListeners = useRef(new Set<(activity: Activity) => void>());
  const statusesRef = useRef<StatusValue[]>(DEFAULT_STATUSES.map((status) => ({ ...status })));
  const fieldsRef = useRef<Pick<Snapshot, 'fields' | 'assignments'>>({ fields: [], assignments: [] });

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

  /**
   * Sets the stories, and the status values when they change too. What this changes for the stories in releases
   * (also through a status value that moves into or out of "done") is appended to the history of the releases.
   */
  const update = useCallback(
    (stories: Story[], statuses: StatusValue[] = statusesRef.current) => {
      const events = releaseEventsFor(storiesRef.current, stories, new Date().toISOString(), newId, isDoneIn(statuses), isDoneIn(statusesRef.current));
      storiesRef.current = stories;
      statusesRef.current = statuses;
      setSnapshot((current) => ({ ...current, stories, statuses, events: events.length > 0 ? [...current.events, ...events] : current.events }));
      if (events.length > 0) persist((repo) => repo.addReleaseEvents(events));
    },
    [persist]
  );

  const updateEpics = useCallback((epics: Epic[]) => {
    epicsRef.current = epics;
    setSnapshot((current) => ({ ...current, epics }));
  }, []);

  const updateSprints = useCallback((sprints: Sprint[]) => {
    sprintsRef.current = sprints;
    setSnapshot((current) => ({ ...current, sprints }));
  }, []);

  const updateReleases = useCallback((releases: Release[]) => {
    releasesRef.current = releases;
    setSnapshot((current) => ({ ...current, releases }));
  }, []);

  const updateSettings = useCallback((settings: Settings) => {
    settingsRef.current = settings;
    setSnapshot((current) => ({ ...current, settings }));
  }, []);

  const updateFields = useCallback((fields: FieldDefinition[], assignments: FieldAssignment[]) => {
    fieldsRef.current = { fields, assignments };
    setSnapshot((current) => ({ ...current, fields, assignments }));
  }, []);

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
        // A story whose status no longer exists gets the start status, so it does not drop off the board.
        const repaired = repairStatuses(loaded.stories, loaded.statuses);
        if (repaired !== loaded.stories) {
          const changed = changedPositions(loaded.stories, repaired);
          await repo.savePositions(changed);
          loaded = { ...loaded, stories: repaired };
        }
        // A release that has stories but no history yet starts its history now.
        const baseline = baselineEvents(loaded.releases, loaded.stories, loaded.events, new Date().toISOString(), newId, isDoneIn(loaded.statuses));
        if (baseline.length > 0) {
          await repo.addReleaseEvents(baseline);
          loaded = { ...loaded, events: [...loaded.events, ...baseline] };
        }
        if (cancelled) return;
        storiesRef.current = loaded.stories;
        epicsRef.current = loaded.epics;
        fieldsRef.current = { fields: loaded.fields, assignments: loaded.assignments };
        sprintsRef.current = loaded.sprints;
        releasesRef.current = loaded.releases;
        settingsRef.current = loaded.settings;
        statusesRef.current = loaded.statuses;
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

  const notify = useCallback((activity: Activity) => {
    for (const listener of [...activityListeners.current]) listener(activity);
  }, []);

  const api = useMemo<AppApi>(
    () => ({
      epics: snapshot.epics,
      sprints: snapshot.sprints,
      releases: snapshot.releases,
      events: snapshot.events,
      stories: snapshot.stories,
      statuses: snapshot.statuses,
      isDone: isDoneIn(snapshot.statuses),
      fields: snapshot.fields,
      assignments: snapshot.assignments,
      settings: snapshot.settings,
      loading,
      error,
      onActivity(listener) {
        activityListeners.current.add(listener);
        return () => {
          activityListeners.current.delete(listener);
        };
      },
      drop(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropStory(before, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
        const statusBefore = before.find((story) => story.id === activeId)?.status;
        if (statusBefore !== after.find((story) => story.id === activeId)?.status) notify('moved');
      },
      dropInBacklog(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropInBacklog(before, sprintsRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
        notify('ordered');
      },
      dropOnMap(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropOnMap(before, sprintsRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      dropOnReleaseMap(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropOnReleaseMap(before, sprintsRef.current, releasesRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      setMapRows(rows) {
        if (settingsRef.current.mapRows === rows) return;
        const settings = { ...settingsRef.current, mapRows: rows };
        updateSettings(settings);
        persist((repo) => repo.saveSettings(settings));
      },
      setFeature(key, enabled) {
        if (settingsRef.current.features[key] === enabled) return;
        const settings = { ...settingsRef.current, features: { ...settingsRef.current.features, [key]: enabled } };
        updateSettings(settings);
        persist((repo) => repo.saveSettings(settings));
      },
      addStatus(category, label) {
        const id = newId();
        const after = addStatusIn(statusesRef.current, category, label, id);
        if (!after) return null;
        update(storiesRef.current, after);
        persist((repo) => repo.saveStatuses(after));
        return id;
      },
      renameStatus(id, label) {
        const after = renameStatusIn(statusesRef.current, id, label);
        if (!after || after === statusesRef.current) return;
        update(storiesRef.current, after);
        persist((repo) => repo.saveStatuses(after));
      },
      reorderStatuses(places) {
        const after = reorderStatuses(statusesRef.current, places);
        if (!after) return false;
        update(storiesRef.current, after);
        persist((repo) => repo.saveStatuses(after));
        return true;
      },
      removeStatus(id, targetId) {
        const before = storiesRef.current;
        const result = removeStatusIn(statusesRef.current, before, id, targetId);
        if (!result) return false;
        update(result.stories, result.statuses);
        const changed = changedPositions(before, result.stories);
        // The stories move first, so no story is left with a status that is gone.
        persist(async (repo) => {
          await repo.savePositions(changed);
          await repo.saveStatuses(result.statuses);
        });
        return true;
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
      createRelease(input) {
        const id = newId();
        const result = createReleaseIn(releasesRef.current, input, id);
        if (!result) return null;
        updateReleases(result.releases);
        persist((repo) => repo.addRelease(result.release));
        return id;
      },
      updateRelease(id, input) {
        const after = updateReleaseIn(releasesRef.current, id, input);
        const release = after.find((item) => item.id === id);
        if (after === releasesRef.current || !release) return;
        updateReleases(after);
        persist((repo) => repo.updateRelease(release));
      },
      deleteRelease(id) {
        const result = deleteReleaseIn(releasesRef.current, storiesRef.current, id);
        // The history goes with the release, so the stories losing it are not recorded as removed.
        releasesRef.current = result.releases;
        storiesRef.current = result.stories;
        setSnapshot((current) => ({
          ...current,
          releases: result.releases,
          stories: result.stories,
          events: current.events.filter((event) => event.releaseId !== id)
        }));
        persist((repo) => repo.deleteRelease(id));
      },
      createStory(input) {
        const id = newId();
        const result = createStoryIn(storiesRef.current, input, id, startStatus(statusesRef.current));
        update(result.stories);
        persist((repo) => repo.addStory(result.story));
        notify('created');
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
        const before = fields.find((field) => field.id === id);
        const result = updateFieldIn(fields, id, input, newId);
        if (!result || !before) return false;
        const { field } = result;
        const converted = field.dataType !== before.dataType && field.kind === 'custom';
        const adapt = <T extends Story | Epic>(items: T[]): T[] => {
          const changed = converted ? convertValues(items, id, field.dataType as FieldInput['dataType']) : items;
          return dropRemovedOptions(changed, field);
        };
        const stories = adapt(storiesRef.current);
        const epics = adapt(epicsRef.current);
        updateFields(result.fields, assignments);
        update(stories);
        updateEpics(epics);
        persist(async (repo) => {
          await repo.saveField(field);
          if (!converted) return;
          // Each value moves to the storage of its new type.
          for (const item of [...stories, ...epics]) {
            const value = item.values[id];
            if (value !== undefined) await repo.setFieldValue(item.id, id, value);
          }
        });
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
      renameBuiltinField(fieldId, label) {
        const { fields, assignments } = fieldsRef.current;
        const result = renameBuiltin(fields, fieldId, label);
        if (!result) return;
        updateFields(result.fields, assignments);
        persist((repo) => repo.saveField(result.field));
      },
      setBuiltinFieldHidden(fieldId, itemType, hidden) {
        const { fields, assignments } = fieldsRef.current;
        const after = setBuiltinHidden(fields, assignments, fieldId, itemType, hidden);
        if (!after) return;
        updateFields(fields, after);
        persist((repo) => repo.saveAssignments(fieldId, after.filter((item) => item.fieldId === fieldId)));
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
    [snapshot, loading, error, update, updateEpics, updateSprints, updateReleases, updateSettings, updateFields, persist, notify]
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
