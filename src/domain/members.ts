import type { Member, Story } from './types';

/** The most characters the initials of a member can have. */
export const MAX_INITIALS = 3;

/** Why a name or initials are refused. */
export type MemberProblem = 'nameEmpty' | 'nameTaken' | 'initialsEmpty' | 'initialsTooLong' | 'initialsTaken';

const clean = (text: string): string => text.trim().replace(/\s+/g, ' ');

/**
 * Initials from a name: the first letter of the first and of the last word, or the first two letters of a single
 * word. They are upper case and never longer than `MAX_INITIALS`.
 */
export function deriveInitials(name: string): string {
  const words = clean(name)
    .split(' ')
    .filter((word) => word !== '');
  if (words.length === 0) return '';
  const letters = (word: string): string[] => Array.from(word).filter((char) => /\p{L}|\p{N}/u.test(char));
  const first = letters(words[0]);
  if (words.length === 1) return first.slice(0, 2).join('').toUpperCase();
  const last = letters(words[words.length - 1]);
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

const sameName = (a: string, b: string): boolean => clean(a).toLocaleLowerCase() === clean(b).toLocaleLowerCase();
const sameInitials = (a: string, b: string): boolean => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Initials that no other member has: the derived ones, or the derived ones with a number (`AK2`). */
export function freeInitials(name: string, members: readonly Member[], ignoreId?: string): string {
  const base = deriveInitials(name);
  const taken = (initials: string): boolean => members.some((member) => member.id !== ignoreId && sameInitials(member.initials, initials));
  if (base === '' || !taken(base)) return base;
  const stem = base.slice(0, MAX_INITIALS - 1);
  for (let number = 2; number < 100; number += 1) {
    const candidate = `${stem}${number}`.slice(0, MAX_INITIALS);
    if (!taken(candidate)) return candidate;
  }
  return base;
}

/** The first problem with a name and initials, or null when they can be saved. `ignoreId` is the member being changed. */
export function checkMember(members: readonly Member[], name: string, initials: string, ignoreId?: string): MemberProblem | null {
  const others = members.filter((member) => member.id !== ignoreId);
  if (clean(name) === '') return 'nameEmpty';
  if (others.some((member) => sameName(member.name, name))) return 'nameTaken';
  const short = initials.trim();
  if (short === '') return 'initialsEmpty';
  if (Array.from(short).length > MAX_INITIALS) return 'initialsTooLong';
  if (others.some((member) => sameInitials(member.initials, short))) return 'initialsTaken';
  return null;
}

export type MemberResult = { ok: true; members: Member[]; member: Member } | { ok: false; problem: MemberProblem };

/** Adds a member at the end of the list. Without initials they are derived from the name. */
export function addMember(members: readonly Member[], id: string, name: string, initials?: string): MemberResult {
  const text = clean(name);
  const short = (initials ?? freeInitials(text, members)).trim();
  const problem = checkMember(members, text, short);
  if (problem) return { ok: false, problem };
  const member: Member = { id, name: text, initials: short.toUpperCase() };
  return { ok: true, members: [...members, member], member };
}

/** Whether the initials of a member still are the ones their name gives, so they follow the name when it changes. */
export function initialsFollowName(members: readonly Member[], member: Member): boolean {
  return sameInitials(member.initials, deriveInitials(member.name)) || sameInitials(member.initials, freeInitials(member.name, members, member.id));
}

/**
 * Changes name and initials of a member. When the initials were never changed by hand (they are still the ones the old
 * name gives) and the caller gives none, they follow the new name; initials set by hand stay.
 */
export function changeMember(members: readonly Member[], id: string, patch: { name?: string; initials?: string }): MemberResult {
  const old = members.find((member) => member.id === id);
  if (!old) return { ok: false, problem: 'nameEmpty' };
  const name = clean(patch.name ?? old.name);
  const followsName = initialsFollowName(members, old);
  const initials = (patch.initials ?? (followsName && name !== clean(old.name) ? freeInitials(name, members, id) : old.initials)).trim();
  const problem = checkMember(members, name, initials, id);
  if (problem) return { ok: false, problem };
  const member: Member = { id, name, initials: initials.toUpperCase() };
  return { ok: true, members: members.map((item) => (item.id === id ? member : item)), member };
}

/** The stories assigned to a member. */
export function storiesOfMember(stories: readonly Story[], memberId: string): Story[] {
  return stories.filter((story) => story.assigneeId === memberId);
}

/** Removes a member; the stories assigned to them are not assigned any more. */
export function removeMember(members: readonly Member[], stories: readonly Story[], id: string): { members: Member[]; stories: Story[] } {
  return {
    members: members.filter((member) => member.id !== id),
    stories: stories.map((story) => (story.assigneeId === id ? { ...story, assigneeId: null } : story))
  };
}

/** The member a story is assigned to, or undefined. */
export function assigneeOf(members: readonly Member[], story: Pick<Story, 'assigneeId'>): Member | undefined {
  return story.assigneeId ? members.find((member) => member.id === story.assigneeId) : undefined;
}

/** What the board shows: all stories, the stories without assignee, or those of one member. */
export type MemberFilter = { kind: 'all' } | { kind: 'none' } | { kind: 'member'; memberId: string };

export const ALL_MEMBERS: MemberFilter = { kind: 'all' };

export function matchesMemberFilter(story: Pick<Story, 'assigneeId'>, filter: MemberFilter): boolean {
  if (filter.kind === 'all') return true;
  if (filter.kind === 'none') return !story.assigneeId;
  return story.assigneeId === filter.memberId;
}
