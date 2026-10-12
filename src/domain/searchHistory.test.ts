import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  forgetOpened,
  forgetSearch,
  parseHistory,
  rememberOpened,
  rememberSearch
} from './searchHistory';

describe('search history', () => {
  it('keeps the newest search first, without duplicates and empty searches', () => {
    let history = rememberSearch(EMPTY_HISTORY, { text: 'login', filters: [] });
    history = rememberSearch(history, { text: 'export', filters: [] });
    history = rememberSearch(history, { text: ' Login ', filters: [] });
    history = rememberSearch(history, { text: '  ', filters: [] });
    expect(history.searches.map((query) => query.text)).toEqual(['Login', 'export']);
  });

  it('keeps chips without values out of a remembered search', () => {
    const history = rememberSearch(EMPTY_HISTORY, {
      text: '',
      filters: [
        { field: 'status', values: ['done'], negate: false },
        { field: 'epic', values: [], negate: false }
      ]
    });
    expect(history.searches[0].filters).toEqual([{ field: 'status', values: ['done'], negate: false }]);
  });

  it(`keeps at most ${HISTORY_LIMIT} searches and opened items`, () => {
    let history = EMPTY_HISTORY;
    for (let i = 0; i < 8; i += 1) {
      history = rememberSearch(history, { text: `q${i}`, filters: [] });
      history = rememberOpened(history, { kind: 'story', id: `s${i}` });
    }
    expect(history.searches).toHaveLength(HISTORY_LIMIT);
    expect(history.searches[0].text).toBe('q7');
    expect(history.opened).toHaveLength(HISTORY_LIMIT);
    expect(history.opened[0].id).toBe('s7');
  });

  it('moves an item opened again to the top and leaves the history alone when it is already first', () => {
    let history = rememberOpened(EMPTY_HISTORY, { kind: 'story', id: 'a' });
    history = rememberOpened(history, { kind: 'epic', id: 'b' });
    history = rememberOpened(history, { kind: 'story', id: 'a' });
    expect(history.opened).toEqual([
      { kind: 'story', id: 'a' },
      { kind: 'epic', id: 'b' }
    ]);
    expect(rememberOpened(history, { kind: 'story', id: 'a' })).toBe(history);
  });

  it('forgets single entries', () => {
    let history = rememberSearch(EMPTY_HISTORY, { text: 'a', filters: [] });
    history = rememberSearch(history, { text: 'b', filters: [] });
    history = rememberOpened(history, { kind: 'sprint', id: 's' });
    expect(forgetSearch(history, 0).searches.map((query) => query.text)).toEqual(['a']);
    expect(forgetOpened(history, { kind: 'sprint', id: 's' }).opened).toEqual([]);
  });

  it('reads a stored history and drops broken entries', () => {
    expect(parseHistory(null)).toEqual(EMPTY_HISTORY);
    expect(
      parseHistory({
        searches: [{ text: 'ok', filters: [] }, { text: 3 }, { text: 'bad', filters: [{ field: 'status' }] }],
        opened: [{ kind: 'story', id: 'x' }, { kind: 'page', id: 'y' }]
      })
    ).toEqual({ searches: [{ text: 'ok', filters: [] }], opened: [{ kind: 'story', id: 'x' }] });
  });
});
