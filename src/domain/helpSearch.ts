import { findRanges, fold, makeSnippet, parseTerms, type Range, type Snippet } from './search';

/** The searchable texts of one help topic, in the current language. */
export interface HelpEntry {
  id: string;
  title: string;
  /** Extra words that find the topic but are not shown. */
  keywords: string;
  body: string;
}

export interface HelpHit {
  id: string;
  score: number;
  titleRanges: Range[];
  /** The place in the text where the terms match, when the title does not show it. */
  snippet: Snippet | null;
}

const TITLE_WORD = 12;
const TITLE_PART = 8;
const KEYWORD = 5;
const BODY = 1;
const BODY_CAP = 3;

/** Whether `term` starts a word in the folded text. */
function startsWord(folded: string, term: string): boolean {
  let from = folded.indexOf(term);
  while (from !== -1) {
    if (from === 0 || /[^\p{L}\p{N}]/u.test(folded[from - 1])) return true;
    from = folded.indexOf(term, from + 1);
  }
  return false;
}

function countIn(folded: string, term: string): number {
  let count = 0;
  let from = folded.indexOf(term);
  while (from !== -1) {
    count += 1;
    from = folded.indexOf(term, from + 1);
  }
  return count;
}

/**
 * Finds the topics that contain every word of the query, ignoring case and accents. Words in quotes are searched
 * as a phrase. A match in the title ranks above one in the keywords, and that above one in the text; topics with the
 * same rank keep the order of `entries`. An empty query finds nothing.
 */
export function searchHelp(entries: readonly HelpEntry[], text: string): HelpHit[] {
  const terms = parseTerms(text);
  if (terms.length === 0) return [];
  const hits: HelpHit[] = [];
  for (const entry of entries) {
    const title = fold(entry.title);
    const keywords = fold(entry.keywords);
    const body = fold(entry.body);
    let score = 0;
    let found = true;
    for (const term of terms) {
      const inTitle = title.includes(term);
      const inKeywords = keywords.includes(term);
      const inBody = body.includes(term);
      if (!inTitle && !inKeywords && !inBody) {
        found = false;
        break;
      }
      if (inTitle) score += startsWord(title, term) ? TITLE_WORD : TITLE_PART;
      if (inKeywords) score += KEYWORD;
      if (inBody) score += BODY * Math.min(BODY_CAP, countIn(body, term));
    }
    if (!found) continue;
    const titleRanges = findRanges(entry.title, terms);
    const inBodyText = findRanges(entry.body, terms).length > 0;
    hits.push({ id: entry.id, score, titleRanges, snippet: inBodyText ? makeSnippet('description', entry.body, terms) : null });
  }
  // Array.prototype.sort is stable, so equal scores stay in the order of the topics.
  return hits.sort((a, b) => b.score - a.score);
}
