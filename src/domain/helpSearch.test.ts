import { describe, expect, it } from 'vitest';
import { searchHelp, type HelpEntry } from './helpSearch';

const entries: HelpEntry[] = [
  { id: 'move', title: 'Move a story', keywords: 'status column drag keyboard', body: 'Drag a card into another column to change its status.\nThe change is saved at once.' },
  { id: 'columns', title: 'Columns and status values', keywords: 'workflow category', body: 'Every column of the board is a status value.' },
  { id: 'order', title: 'Order the backlog', keywords: 'priority rank drag', body: 'The backlog is ordered by priority. Drag a row to another place.' },
  { id: 'keys', title: 'Keyboard shortcuts', keywords: 'keys hotkey', body: 'Press Ctrl+F to search.' },
  { id: 'cafe', title: 'Café menu', keywords: '', body: 'Zürich and Genève are places.' }
];

const ids = (text: string): string[] => searchHelp(entries, text).map((hit) => hit.id);

describe('help search', () => {
  it('AC3.1 finds a topic by a word of its title and marks the word', () => {
    const [hit] = searchHelp(entries, 'move');
    expect(hit.id).toBe('move');
    expect(hit.titleRanges).toEqual([{ start: 0, end: 4 }]);
  });

  it('AC3.2 ignores case and accents', () => {
    expect(ids('MOVE A STORY')[0]).toBe('move');
    expect(ids('cafe')).toEqual(['cafe']);
    expect(ids('CAFÉ')).toEqual(['cafe']);
    expect(ids('zurich')).toEqual(['cafe']);
    expect(ids('geneve')).toEqual(['cafe']);
  });

  it('AC3.2 marks a match in the original spelling, accents included', () => {
    expect(searchHelp(entries, 'cafe')[0].titleRanges).toEqual([{ start: 0, end: 4 }]);
  });

  it('AC3.3 needs every word of the query, in any order', () => {
    expect(ids('story column')).toEqual(['move']);
    expect(ids('column story')).toEqual(['move']);
    expect(ids('story backlog')).toEqual([]);
  });

  it('AC3.3 searches a phrase in double quotes as a phrase', () => {
    expect(ids('"another column"')).toEqual(['move']);
    expect(ids('"column another"')).toEqual([]);
  });

  it('AC3.4 finds nothing for an unknown word and for an empty query', () => {
    expect(ids('xyzxyz')).toEqual([]);
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it('AC3.1 ranks a match in the title above one in the keywords, and that above one in the text', () => {
    // "status" is in the title of "columns", the keywords of "move" and only the text of nothing else
    expect(ids('status')).toEqual(['columns', 'move']);
    // "priority" is in the keywords and the text of "order"; "change" is only in the text of "move"
    expect(ids('change')).toEqual(['move']);
  });

  it('AC3.1 ranks a word that starts a word of the title above a match inside a word', () => {
    const list: HelpEntry[] = [
      { id: 'inside', title: 'Backlog', keywords: '', body: '' },
      { id: 'start', title: 'The log', keywords: '', body: '' }
    ];
    expect(searchHelp(list, 'log').map((hit) => hit.id)).toEqual(['start', 'inside']);
  });

  it('keeps the order of the topics when they rank the same', () => {
    const list: HelpEntry[] = [
      { id: 'b', title: 'Topic B', keywords: '', body: 'alpha' },
      { id: 'a', title: 'Topic A', keywords: '', body: 'alpha' }
    ];
    expect(searchHelp(list, 'alpha').map((hit) => hit.id)).toEqual(['b', 'a']);
  });

  it('AC3.1 shows where the text matches when the title does not', () => {
    const [hit] = searchHelp(entries, 'saved');
    expect(hit.id).toBe('move');
    expect(hit.titleRanges).toEqual([]);
    expect(hit.snippet?.text).toContain('saved');
    expect(hit.snippet?.ranges).toHaveLength(1);
  });

  it('AC3.6 finds a topic by words of its text from any page', () => {
    expect(ids('row')).toEqual(['order']);
  });
});
