import { normalizeStatuses, STATUS_CATEGORIES } from './statuses';
import type { StatusCategory, StatusValue, Story } from './types';

/** A status of the workflow of a service: its name and what it counts as. */
export interface ServiceStatus {
  name: string;
  category: 'new' | 'indeterminate' | 'done';
}

const CATEGORY: Record<ServiceStatus['category'], StatusCategory> = { new: 'not_started', indeterminate: 'in_progress', done: 'done' };

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const nameOf = (status: StatusValue): string => (status.label ?? status.id.replace(/_/g, ' ')).trim();

/**
 * The columns of the board from the statuses of a service (#66, AC13): the service decides names, categories and order.
 * A status keeps its id when a column has its name; else the next column of the same category that no status of the service
 * names is reused (so the stories and the history stay), else a column is made. Columns the service has no status for are
 * removed, and their stories move to the first column of the same category (or the first column). Nothing changes when the
 * service names no status.
 */
export function statusesFromService(
  local: readonly StatusValue[],
  stories: readonly Story[],
  external: readonly ServiceStatus[],
  newId: () => string
): { statuses: StatusValue[]; stories: Story[]; changed: boolean } {
  if (external.length === 0) return { statuses: [...local], stories: [...stories], changed: false };
  const wanted = external.filter((status, index) => external.findIndex((other) => same(other.name, status.name)) === index);
  const used = new Set<string>();
  const result: StatusValue[] = [];
  const reusable = (category: StatusCategory): StatusValue | undefined =>
    local.find((status) => !used.has(status.id) && status.category === category && !wanted.some((item) => same(item.name, nameOf(status))));
  for (const item of wanted) {
    const category = CATEGORY[item.category];
    const found = local.find((status) => !used.has(status.id) && same(nameOf(status), item.name)) ?? reusable(category);
    if (found) {
      used.add(found.id);
      result.push({ id: found.id, label: item.name, category });
    } else {
      result.push({ id: newId(), label: item.name, category });
    }
  }
  const statuses = normalizeStatuses(result);
  // The first column of each category, to take the stories of the columns that are gone.
  const firstOf = (category: StatusCategory): string | undefined => statuses.find((status) => status.category === category)?.id;
  const known = new Set(statuses.map((status) => status.id));
  const moved = stories.map((story) => {
    if (known.has(story.status)) return story;
    const old = local.find((status) => status.id === story.status)?.category;
    const target = (old ? firstOf(old) : undefined) ?? firstOf(STATUS_CATEGORIES[0]) ?? statuses[0].id;
    return { ...story, status: target };
  });
  const changed = JSON.stringify(statuses) !== JSON.stringify(local) || moved.some((story, index) => story !== stories[index]);
  return { statuses, stories: moved, changed };
}
