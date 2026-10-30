import type { Story } from './types';

/** Lower case without accents, so "Ärger" is found by "arger" and "É" by "e". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}

/** The words of a query; an empty list means "no filter". */
function words(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/** What a story is searched in: its key (also without the dash, so "s7" finds "S-7") and its title. */
function haystack(story: Pick<Story, 'code' | 'title' | 'link'>): string {
  const code = normalizeText(story.code);
  // A linked story is found by the key of its issue too (#66).
  const key = story.link ? normalizeText(story.link.key) : '';
  return `${code} ${code.replace(/-/g, '')} ${key} ${key.replace(/[#-]/g, '')} ${normalizeText(story.title)}`;
}

/**
 * Stories whose key and title contain every word of the query, in any order, ignoring case and accents.
 * An empty query returns all stories in backlog order. Best matches first: the exact key, then a key that
 * starts with the query, then a title that starts with it, then the rest by rank.
 */
export function searchStories<T extends Pick<Story, 'code' | 'title' | 'rank'> & Partial<Pick<Story, 'link'>>>(stories: readonly T[], query: string): T[] {
  const terms = words(query);
  const ordered = [...stories].sort((a, b) => a.rank - b.rank);
  if (terms.length === 0) return ordered;
  const whole = normalizeText(query).trim();
  const score = (story: T): number => {
    const code = normalizeText(story.code);
    const compact = code.replace(/-/g, '');
    const number = code.replace(/^[a-z]+-?/, '');
    const bare = whole.replace(/-/g, '');
    const title = normalizeText(story.title);
    const key = story.link ? normalizeText(story.link.key) : '';
    if (key !== '' && key === whole) return 0;
    if (key !== '' && key.startsWith(whole)) return 1;
    if (code === whole || compact === bare || number === whole) return 0;
    if (code.startsWith(whole) || compact.startsWith(bare) || number.startsWith(whole)) return 1;
    if (title.startsWith(whole)) return 2;
    return 3;
  };
  return ordered
    .filter((story) => terms.every((term) => haystack(story).includes(term)))
    .map((story, index) => ({ story, index, rank: score(story) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.story);
}
