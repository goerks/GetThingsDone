import type { Member, Story } from './types';

/** A person of the service who can be assigned (Jira: a user who may be assigned in the project; bots are left out by the connector). */
export interface ServiceMember {
  id: string;
  name: string;
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Up to two capitals from the name ("Anna Meier" is "AM"). */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => [...part][0]?.toUpperCase() ?? '');
  const initials = letters.length > 1 ? `${letters[0]}${letters[letters.length - 1]}` : letters.join('');
  return initials || '?';
}

/**
 * The team from the people of a service (#66, AC14): the service decides. A member with the name of a person stays (id and
 * initials too), a person without a member becomes one, and members without a person are removed and their stories lose the
 * assignee. Nothing changes when the service names nobody.
 */
export function membersFromService(
  local: readonly Member[],
  stories: readonly Story[],
  external: readonly ServiceMember[],
  newId: () => string
): { members: Member[]; stories: Story[]; changed: boolean } {
  if (external.length === 0) return { members: [...local], stories: [...stories], changed: false };
  const used = new Set<string>();
  const members: Member[] = [];
  for (const person of external) {
    if (members.some((member) => same(member.name, person.name))) continue;
    const found = local.find((member) => !used.has(member.id) && same(member.name, person.name));
    if (found) {
      used.add(found.id);
      members.push(found);
    } else {
      members.push({ id: newId(), name: person.name.trim(), initials: initialsOf(person.name) });
    }
  }
  const known = new Set(members.map((member) => member.id));
  const cleared = stories.map((story) => (story.assigneeId && !known.has(story.assigneeId) ? { ...story, assigneeId: null } : story));
  const changed = JSON.stringify(members) !== JSON.stringify(local) || cleared.some((story, index) => story !== stories[index]);
  return { members, stories: cleared, changed };
}
