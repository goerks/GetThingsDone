import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Repository } from '../data/repository';
import { statusLabel } from '../components/statusLabel';
import { useToast } from './Toast';
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
import { applyWrites, baselineWrites, orphanRemovals, recordWorld, statesOf, type ChangeVersion, type World } from '../domain/changeLog';
import { addMember as addMemberIn, changeMember as changeMemberIn, removeMember as removeMemberIn, storiesOfMember, type MemberResult } from '../domain/members';
import { baselineEvents, releaseEventsFor } from '../domain/history';
import { newId } from '../domain/ids';
import {
  createSprint as createSprintIn,
  moveSprint as moveSprintIn,
  todayIso,
  updateSprint as updateSprintIn,
  type SprintInput
} from '../domain/sprints';
import { completeSprint as completeSprintIn, startSprint as startSprintIn, type Completion, type UnfinishedTarget } from '../domain/sprintLife';
import {
  createRelease as createReleaseIn,
  deleteRelease as deleteReleaseIn,
  updateRelease as updateReleaseIn,
  type ReleaseInput
} from '../domain/releases';
import { gatesToAsk, pruneChecks, setCheck as setCheckIn, withDoneSnapshots } from '../domain/definitions';
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
  DefinitionCheck,
  DefinitionKind,
  Definitions,
  Epic,
  FieldAssignment,
  FieldDefinition,
  FieldValue,
  ItemType,
  FeatureKey,
  MapRows,
  Member,
  Release,
  ReleaseEvent,
  Settings,
  Snapshot,
  Sprint,
  StatusCategory,
  StatusValue,
  Story
} from '../domain/types';

/** A change of status that waits for the user: the story and the lists it crosses, in order. */
export interface Transition {
  storyId: string;
  from: string;
  to: string;
  gates: DefinitionKind[];
}

interface AppApi {
  epics: Epic[];
  /** The team members (#18), in the order of the list. */
  members: Member[];
  sprints: Sprint[];
  releases: Release[];
  /** History of the releases, oldest first (#10). */
  events: ReleaseEvent[];
  /** Versions of stories, epics, sprints and releases, oldest first (#23). */
  changeLog: ChangeVersion[];
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
  /** Replaces all data with the snapshot of an export file (#16). Rejects when the data could not be stored; then nothing is shown as replaced. */
  importData(snapshot: Snapshot): Promise<void>;
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
  /** Starts a planned sprint (#17), when none is running. Returns false when it cannot be started. */
  startSprint(id: string, dates: 'today' | 'keep'): boolean;
  /**
   * Completes the running sprint: stores its result and moves the unfinished stories to the target.
   * Returns what happened, or null when the sprint cannot be completed.
   */
  completeSprint(id: string, input: { target: UnfinishedTarget; endDate: 'today' | 'keep' }): Completion | null;
  /** Returns the id of the new release, or null when the input is invalid. */
  createRelease(input: ReleaseInput): string | null;
  /** Changes a release; invalid input is ignored. */
  updateRelease(id: string, input: ReleaseInput): void;
  /** Deletes a release. Its stories stay and lose their release. */
  deleteRelease(id: string): void;
  /** Creates a story and tells the user; the story is highlighted afterwards. */
  createStory(input: NewStoryInput): string;
  updateStory(id: string, patch: StoryPatch): void;
  /** Changes a story from a menu: like `updateStory`, plus a notice and the highlight (#32). */
  changeStory(id: string, patch: StoryPatch): void;
  /** Sets the Definition of Ready and Done lists of the team (#26); checks of removed items are dropped. */
  setDefinitions(definitions: Definitions): void;
  /** Sets an item of a story to "checked" or "not relevant", or makes it open again (null). */
  setCheck(storyId: string, itemId: string, state: DefinitionCheck | null): void;
  /**
   * A change of status that crosses a list the story does not meet is held back until the user decides (#26).
   * `move` carries it out as it was asked, `cancel` drops it.
   */
  transition: Transition | null;
  resolveTransition(action: 'move' | 'cancel'): void;
  /** The story that was just created or moved and is highlighted for a moment, or null. */
  flashed: string | null;
  /** Whether the highlighted story is also scrolled into view: not after a drag, the drop put it where the user is looking. */
  flashScroll: boolean;
  deleteStory(id: string): void;
  toggleCriterion(storyId: string, criterionId: string): void;
  addCriterion(storyId: string, text: string): void;
  editCriterion(storyId: string, criterionId: string, text: string): void;
  deleteCriterion(storyId: string, criterionId: string): void;
  moveCriterion(storyId: string, activeId: string, overId: string): void;
  /** Adds a team member. Without initials they are derived from the name. Gives the member, or the problem. */
  createMember(name: string, initials?: string): MemberResult;
  /** Changes name and/or initials of a member. Gives the member, or the problem; then nothing is changed. */
  updateMember(id: string, patch: { name?: string; initials?: string }): MemberResult;
  /** Removes a member; the stories assigned to them are not assigned any more. Returns how many stories that was. */
  removeMember(id: string): number;
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
  const toast = useToast();
  const [flashed, setFlashed] = useState<string | null>(null);
  const [flashScroll, setFlashScroll] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    epics: [],
    sprints: [],
    releases: [],
    members: [],
    events: [],
    changeLog: [],
    stories: [],
    statuses: DEFAULT_STATUSES.map((status) => ({ ...status })),
    fields: [],
    assignments: [],
    settings: DEFAULT_SETTINGS
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bypassGate = useRef(false);
  const [pending, setPending] = useState<(Transition & { commit: () => void }) | null>(null);
  const repoRef = useRef<Repository | null>(null);
  const storiesRef = useRef<Story[]>([]);
  const epicsRef = useRef<Epic[]>([]);
  const sprintsRef = useRef<Sprint[]>([]);
  const releasesRef = useRef<Release[]>([]);
  const membersRef = useRef<Member[]>([]);
  const changeLogRef = useRef<ChangeVersion[]>([]);
  /** While set, changes are not recorded one by one: the caller recorded them together. */
  const quiet = useRef(false);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const activityListeners = useRef(new Set<(activity: Activity) => void>());
  const statusesRef = useRef<StatusValue[]>(DEFAULT_STATUSES.map((status) => ({ ...status })));
  const fieldsRef = useRef<Pick<Snapshot, 'fields' | 'assignments'>>({ fields: [], assignments: [] });

  /** Highlights a story for two seconds. */
  const flash = useCallback((id: string, scroll: boolean) => {
    clearTimeout(flashTimer.current);
    setFlashScroll(scroll);
    setFlashed(id);
    flashTimer.current = setTimeout(() => setFlashed(null), 2000);
  }, []);

  /** Tells the user what a move changed (status first, then sprint, epic, release, points) and highlights the story. */
  const announceMove = useCallback(
    (before: Story[], after: Story[], id: string, scroll: boolean) => {
      const was = before.find((story) => story.id === id);
      const now = after.find((story) => story.id === id);
      if (!was || !now) return;
      flash(id, scroll);
      const code = now.code;
      if (was.status !== now.status) {
        toast.notify(t('toast.moved.status', { code, target: statusLabel(t, statusesRef.current, now.status) }));
      } else if (was.sprintId !== now.sprintId) {
        const sprint = sprintsRef.current.find((item) => item.id === now.sprintId);
        toast.notify(t('toast.moved.sprint', { code, target: sprint ? sprint.name : t('sprint.notPlanned') }));
      } else if (was.epicId !== now.epicId) {
        const epic = epicsRef.current.find((item) => item.id === now.epicId);
        toast.notify(epic ? t('toast.moved.epic', { code, target: epic.name }) : t('toast.moved.noEpic', { code }));
      } else if (was.releaseId !== now.releaseId) {
        const release = releasesRef.current.find((item) => item.id === now.releaseId);
        toast.notify(release ? t('toast.moved.release', { code, target: release.title }) : t('toast.moved.noRelease', { code }));
      } else if (was.points !== now.points) {
        toast.notify(t('toast.moved.points', { code, count: now.points }));
      } else {
        toast.notify(t('toast.moved.reordered', { code }));
      }
    },
    [flash, t, toast]
  );

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
   * Records what a change of the stories, epics, sprints or releases does to the change log (#23): a new version for each
   * item whose tracked fields changed. Call it before the refs are replaced; `next` holds the collections that change.
   */
  const track = useCallback(
    (next: Partial<World>) => {
      if (quiet.current) return;
      const before: World = { stories: storiesRef.current, epics: epicsRef.current, sprints: sprintsRef.current, releases: releasesRef.current, members: membersRef.current };
      const writes = recordWorld(changeLogRef.current, before, { ...before, ...next }, new Date().toISOString(), newId);
      if (writes.upsert.length === 0 && writes.remove.length === 0) return;
      const changeLog = applyWrites(changeLogRef.current, writes);
      changeLogRef.current = changeLog;
      setSnapshot((current) => ({ ...current, changeLog }));
      persist((repo) => repo.applyChangeLog(writes));
    },
    [persist]
  );

  /**
   * Sets the stories, and the status values when they change too. What this changes for the stories in releases
   * (also through a status value that moves into or out of "done") is appended to the history of the releases.
   */
  const update = useCallback(
    (changed: Story[], statuses: StatusValue[] = statusesRef.current) => {
      const before = storiesRef.current;
      // A story that becomes done remembers the Done list it is held to (#26).
      const stories = withDoneSnapshots(before, changed, isDoneIn(statusesRef.current), isDoneIn(statuses), settingsRef.current.definitions);
      track({ stories });
      const events = releaseEventsFor(before, stories, new Date().toISOString(), newId, isDoneIn(statuses), isDoneIn(statusesRef.current));
      const previous = new Map(before.map((story) => [story.id, story]));
      const checked = stories.filter((story) => {
        const old = previous.get(story.id);
        return old !== undefined && (old.checks !== story.checks || old.doneItems !== story.doneItems);
      });
      if (checked.length > 0) {
        persist(async (repo) => {
          for (const story of checked) await repo.saveStoryChecks(story.id, story.checks, story.doneItems);
        });
      }
      storiesRef.current = stories;
      statusesRef.current = statuses;
      setSnapshot((current) => ({ ...current, stories, statuses, events: events.length > 0 ? [...current.events, ...events] : current.events }));
      if (events.length > 0) persist((repo) => repo.addReleaseEvents(events));
    },
    [persist, track]
  );

  const updateEpics = useCallback(
    (epics: Epic[]) => {
      track({ epics });
      epicsRef.current = epics;
      setSnapshot((current) => ({ ...current, epics }));
    },
    [track]
  );

  const updateSprints = useCallback(
    (sprints: Sprint[]) => {
      track({ sprints });
      sprintsRef.current = sprints;
      setSnapshot((current) => ({ ...current, sprints }));
    },
    [track]
  );

  const updateReleases = useCallback(
    (releases: Release[]) => {
      track({ releases });
      releasesRef.current = releases;
      setSnapshot((current) => ({ ...current, releases }));
    },
    [track]
  );

  const updateSettings = useCallback((settings: Settings) => {
    settingsRef.current = settings;
    setSnapshot((current) => ({ ...current, settings }));
  }, []);

  const updateFields = useCallback((fields: FieldDefinition[], assignments: FieldAssignment[]) => {
    fieldsRef.current = { fields, assignments };
    setSnapshot((current) => ({ ...current, fields, assignments }));
  }, []);

  /** Makes a snapshot the data shown by the app. */
  const adopt = useCallback((loaded: Snapshot) => {
    storiesRef.current = loaded.stories;
    epicsRef.current = loaded.epics;
    fieldsRef.current = { fields: loaded.fields, assignments: loaded.assignments };
    sprintsRef.current = loaded.sprints;
    releasesRef.current = loaded.releases;
    membersRef.current = loaded.members;
    changeLogRef.current = loaded.changeLog;
    settingsRef.current = loaded.settings;
    statusesRef.current = loaded.statuses;
    setSnapshot(loaded);
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
        // An item that is older than the change log gets its first version now, so it can be compared later.
        const states = statesOf(loaded);
        const writes = { ...baselineWrites(loaded.changeLog, states, new Date().toISOString(), newId), remove: orphanRemovals(loaded.changeLog, states) };
        if (writes.upsert.length > 0 || writes.remove.length > 0) {
          await repo.applyChangeLog(writes);
          loaded = { ...loaded, changeLog: applyWrites(loaded.changeLog, writes) };
        }
        if (cancelled) return;
        adopt(loaded);
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

  /**
   * Holds back a change of status that crosses a Definition list the story does not meet (#26): the change waits in
   * `pending` until the user decides. Returns true when the change was held back.
   */
  const gate = useCallback((storyId: string, to: string, commit: () => void): boolean => {
    if (bypassGate.current) return false;
    const story = storiesRef.current.find((item) => item.id === storyId);
    if (!story || story.status === to) return false;
    const gates = gatesToAsk(settingsRef.current.definitions, statusesRef.current, story, to);
    if (gates.length === 0) return false;
    setPending({ storyId, from: story.status, to, gates, commit });
    return true;
  }, []);

  const api = useMemo<AppApi>(
    () => ({
      epics: snapshot.epics,
      sprints: snapshot.sprints,
      releases: snapshot.releases,
      members: snapshot.members,
      events: snapshot.events,
      changeLog: snapshot.changeLog,
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
        const target = after.find((story) => story.id === activeId)?.status;
        if (target !== undefined && gate(activeId, target, () => api.drop(activeId, overId, placement))) return;
        update(after);
        announceMove(before, after, activeId, false);
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
        announceMove(before, after, activeId, false);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
        notify('ordered');
      },
      dropOnMap(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropOnMap(before, sprintsRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        announceMove(before, after, activeId, false);
        const changed = changedPositions(before, after);
        persist((repo) => repo.savePositions(changed));
      },
      dropOnReleaseMap(activeId, overId, placement) {
        const before = storiesRef.current;
        const after = dropOnReleaseMap(before, sprintsRef.current, releasesRef.current, activeId, overId, placement);
        if (after === before) return;
        update(after);
        announceMove(before, after, activeId, false);
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
      async importData(next) {
        const repo = repoRef.current;
        if (!repo) throw new Error('The storage is not ready');
        // Let the changes that are still being written finish first, so they cannot land on top of the imported data.
        await queueRef.current;
        // Versions of items that are not in the file are dropped, items without versions get their first one.
        const states = statesOf(next);
        const known = new Set(orphanRemovals(next.changeLog, states));
        const kept = next.changeLog.filter((version) => !known.has(version.id));
        const prepared = { ...next, changeLog: applyWrites(kept, baselineWrites(kept, states, new Date().toISOString(), newId)) };
        await repo.replaceAll(prepared);
        adopt(prepared);
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
        toast.notify(t('toast.created.sprint', { name: result.sprint.name }));
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
      startSprint(id, dates) {
        const after = startSprintIn(sprintsRef.current, storiesRef.current, id, dates, todayIso());
        const sprint = after?.find((item) => item.id === id);
        if (!after || !sprint) return false;
        updateSprints(after);
        persist((repo) => repo.updateSprint(sprint));
        return true;
      },
      completeSprint(id, input) {
        const sprintsBefore = sprintsRef.current;
        const storiesBefore = storiesRef.current;
        const completion = completeSprintIn(sprintsBefore, storiesBefore, id, isDoneIn(statusesRef.current), {
          ...input,
          today: todayIso(),
          newId: newId(),
          nameFor: (number) => t('sprint.defaultName', { number })
        });
        if (!completion) return null;
        // The sprint and its stories change together: one version each.
        track({ sprints: completion.sprints, stories: completion.stories });
        quiet.current = true;
        try {
          updateSprints(completion.sprints);
          update(completion.stories);
        } finally {
          quiet.current = false;
        }
        const moved = changedPositions(storiesBefore, completion.stories);
        persist(async (repo) => {
          if (completion.created && completion.targetSprint) await repo.addSprint(completion.targetSprint);
          await repo.updateSprint(completion.completed);
          if (moved.length > 0) await repo.savePositions(moved);
        });
        return completion;
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
        toast.notify(t('toast.created.release', { title: result.release.title }));
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
        track({ releases: result.releases, stories: result.stories });
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
        toast.notify(t('toast.created.story', { code: result.story.code, title: result.story.title }));
        flash(id, true);
        return id;
      },
      updateStory(id, patch) {
        const after = updateStoryIn(storiesRef.current, id, patch);
        const story = after.find((item) => item.id === id);
        if (!story) return;
        if (patch.status !== undefined && gate(id, patch.status, () => api.updateStory(id, patch))) return;
        update(after);
        persist((repo) => repo.updateStory(story));
      },
      changeStory(id, patch) {
        const before = storiesRef.current;
        const after = updateStoryIn(before, id, patch);
        const story = after.find((item) => item.id === id);
        const was = before.find((item) => item.id === id);
        if (!story || !was || (Object.keys(patch) as Array<keyof StoryPatch>).every((key) => was[key] === story[key])) return;
        if (patch.status !== undefined && gate(id, patch.status, () => api.changeStory(id, patch))) return;
        update(after);
        persist((repo) => repo.updateStory(story));
        announceMove(before, after, id, true);
      },
      setDefinitions(definitions) {
        const settings = { ...settingsRef.current, definitions };
        updateSettings(settings);
        persist((repo) => repo.saveSettings(settings));
        // Items that are gone take their states with them.
        const pruned = pruneChecks(storiesRef.current, definitions);
        if (pruned !== storiesRef.current) update(pruned);
      },
      setCheck(storyId, itemId, state) {
        update(setCheckIn(storiesRef.current, storyId, itemId, state));
      },
      transition: pending ? { storyId: pending.storyId, from: pending.from, to: pending.to, gates: pending.gates } : null,
      resolveTransition(action) {
        const held = pending;
        setPending(null);
        if (action !== 'move' || !held) return;
        // "Move" and the deliberate override carry the change out without asking again.
        bypassGate.current = true;
        try {
          held.commit();
        } finally {
          bypassGate.current = false;
        }
      },
      flashed,
      flashScroll,
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
      createMember(name, initials) {
        const result = addMemberIn(membersRef.current, newId(), name, initials);
        if (!result.ok) return result;
        membersRef.current = result.members;
        setSnapshot((current) => ({ ...current, members: result.members }));
        persist((repo) => repo.addMember(result.member));
        return result;
      },
      updateMember(id, patch) {
        const result = changeMemberIn(membersRef.current, id, patch);
        if (!result.ok) return result;
        membersRef.current = result.members;
        setSnapshot((current) => ({ ...current, members: result.members }));
        persist((repo) => repo.updateMember(result.member));
        return result;
      },
      removeMember(id) {
        const count = storiesOfMember(storiesRef.current, id).length;
        const result = removeMemberIn(membersRef.current, storiesRef.current, id);
        // The stories are saved first, so the history shows them as not assigned, then the member goes.
        if (count > 0) update(result.stories);
        membersRef.current = result.members;
        setSnapshot((current) => ({ ...current, members: result.members }));
        persist((repo) => repo.deleteMember(id));
        return count;
      },
      createEpic(input) {
        const id = newId();
        const result = createEpicIn(epicsRef.current, input, id);
        if (!result) return null;
        updateEpics(result.epics);
        persist((repo) => repo.addEpic(result.epic));
        toast.notify(t('toast.created.epic', { name: result.epic.name }));
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
    [snapshot, loading, error, pending, gate, flashed, flashScroll, update, updateEpics, updateSprints, updateReleases, updateSettings, updateFields, persist, adopt, notify, announceMove, flash, toast, t]
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
