/** A piece of a line; a marked piece is the part that differs from the other side. */
export interface Piece {
  text: string;
  mark: boolean;
}

export interface DiffLine {
  /** Line number in its own text, from 1. */
  no: number;
  pieces: Piece[];
}

/** One row of the side by side view: the line before, the line after, or both. A side without a line is empty. */
export interface DiffRow {
  left: DiffLine | null;
  right: DiffLine | null;
  /** `same` rows show equal lines, `change` rows a changed line or one that only exists on one side. */
  kind: 'same' | 'change';
}

/** The longest common subsequence of two lists as pairs of indexes. */
function commonPairs<T>(a: readonly T[], b: readonly T[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
}

/** Texts this big are compared without the word marks and the common lines, to keep the view fast. */
const MAX_CELLS = 4_000_000;

const tokens = (line: string): string[] => line.split(/(\s+|[.,;:!?])/).filter((token) => token !== '');

function join(parts: Array<{ text: string; mark: boolean }>): Piece[] {
  const pieces: Piece[] = [];
  for (const part of parts) {
    const last = pieces[pieces.length - 1];
    if (last && last.mark === part.mark) last.text += part.text;
    else pieces.push({ text: part.text, mark: part.mark });
  }
  return pieces;
}

/** The two lines with the words that differ marked. */
function markWords(before: string, after: string): [Piece[], Piece[]] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length * b.length > MAX_CELLS) return [[{ text: before, mark: true }], [{ text: after, mark: true }]];
  const pairs = commonPairs(a, b);
  const left = a.map((text) => ({ text, mark: true }));
  const right = b.map((text) => ({ text, mark: true }));
  for (const [i, j] of pairs) {
    left[i].mark = false;
    right[j].mark = false;
  }
  return [join(left), join(right)];
}

const plain = (text: string): Piece[] => (text === '' ? [] : [{ text, mark: false }]);
const marked = (text: string): Piece[] => (text === '' ? [] : [{ text, mark: true }]);

/**
 * Compares two texts line by line for the side by side view. Equal lines stand on both sides; a changed line
 * stands opposite its new version, with the changed words marked; an added or removed line stands opposite an
 * empty side.
 */
export function diffText(before: string, after: string): DiffRow[] {
  const a = before === '' ? [] : before.split(/\r?\n/);
  const b = after === '' ? [] : after.split(/\r?\n/);
  const pairs = a.length * b.length > MAX_CELLS ? [] : commonPairs(a, b);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  const flush = (toI: number, toJ: number): void => {
    // Removed lines meet added lines in order; what is left over stands alone.
    const removed = a.slice(i, toI);
    const added = b.slice(j, toJ);
    const both = Math.min(removed.length, added.length);
    for (let k = 0; k < both; k += 1) {
      const [left, right] = markWords(removed[k], added[k]);
      rows.push({ kind: 'change', left: { no: i + k + 1, pieces: left }, right: { no: j + k + 1, pieces: right } });
    }
    for (let k = both; k < removed.length; k += 1) rows.push({ kind: 'change', left: { no: i + k + 1, pieces: marked(removed[k]) }, right: null });
    for (let k = both; k < added.length; k += 1) rows.push({ kind: 'change', left: null, right: { no: j + k + 1, pieces: marked(added[k]) } });
  };
  for (const [pi, pj] of pairs) {
    flush(pi, pj);
    rows.push({ kind: 'same', left: { no: pi + 1, pieces: plain(a[pi]) }, right: { no: pj + 1, pieces: plain(b[pj]) } });
    i = pi + 1;
    j = pj + 1;
  }
  flush(a.length, b.length);
  return rows;
}
