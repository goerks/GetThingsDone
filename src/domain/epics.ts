import { EPIC_COLOR_KEYS, type Epic, type EpicColorKey, type Story } from './types';

/** Colour keys of release 0.1 before the palette had eight colours. */
const LEGACY_COLOR_KEYS: Record<string, EpicColorKey> = {
  boards: 'blue',
  backlog: 'amber',
  storage: 'teal',
  accessibility: 'violet'
};

export function isColorKey(value: string): value is EpicColorKey {
  return (EPIC_COLOR_KEYS as readonly string[]).includes(value);
}

/** Maps a stored colour key to the palette. Old and unknown keys get a valid colour. */
export function normalizeColorKey(value: string): EpicColorKey {
  if (isColorKey(value)) return value;
  return LEGACY_COLOR_KEYS[value] ?? EPIC_COLOR_KEYS[0];
}

/** The first palette colour that no epic uses yet, or the least used one when all are taken. */
export function nextColorKey(epics: readonly Epic[]): EpicColorKey {
  const usage = new Map<EpicColorKey, number>(EPIC_COLOR_KEYS.map((key) => [key, 0]));
  for (const epic of epics) usage.set(epic.colorKey, (usage.get(epic.colorKey) ?? 0) + 1);
  return EPIC_COLOR_KEYS.reduce((best, key) => ((usage.get(key) ?? 0) < (usage.get(best) ?? 0) ? key : best));
}

export interface NewEpicInput {
  name: string;
  colorKey?: EpicColorKey;
  /** Values of custom fields, from the create dialog. */
  values?: Epic['values'];
}

/** Adds an epic. Returns null when the trimmed name is empty. */
export function createEpic(epics: Epic[], input: NewEpicInput, id: string): { epics: Epic[]; epic: Epic } | null {
  const name = input.name.trim();
  if (!name) return null;
  const position = epics.reduce((max, epic) => Math.max(max, epic.position), -1) + 1;
  const epic: Epic = { id, name, colorKey: input.colorKey ?? nextColorKey(epics), position, size: null, values: input.values ?? {} };
  return { epics: [...epics, epic], epic };
}

export type EpicPatch = Partial<Pick<Epic, 'name' | 'colorKey' | 'size'>>;

/** Renames, recolours or sizes an epic. An empty name is ignored. */
export function updateEpic(epics: Epic[], id: string, patch: EpicPatch): Epic[] {
  const clean: EpicPatch = { ...patch };
  if (clean.name !== undefined) {
    clean.name = clean.name.trim();
    if (!clean.name) delete clean.name;
  }
  return epics.map((epic) => (epic.id === id ? { ...epic, ...clean } : epic));
}

/** Epics in their column order. */
export function sortEpics(epics: readonly Epic[]): Epic[] {
  return [...epics].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function storiesInEpic(stories: readonly Story[], epicId: string): number {
  return stories.filter((story) => story.epicId === epicId).length;
}

/** Removes an epic. An epic that still has stories is kept, so no story loses its epic. */
export function deleteEpic(epics: Epic[], stories: readonly Story[], id: string): Epic[] {
  if (storiesInEpic(stories, id) > 0) return epics;
  return epics.filter((epic) => epic.id !== id);
}
