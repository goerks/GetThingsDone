import { describe, expect, it } from 'vitest';
import { normalizeText, searchStories } from './storySearch';

const story = (code: string, title: string, rank: number) => ({ code, title, rank });
const stories = [
  story('S-1', 'Create a story with title and description', 0),
  story('S-2', 'Tick off acceptance criteria', 1),
  story('S-10', 'Reorder the backlog by priority', 2),
  story('S-11', 'Ärger mit dem Überblick', 3),
  story('S-7', 'Plan releases on a story map', 4)
];
const codes = (query: string): string[] => searchStories(stories, query).map((item) => item.code);

describe('normalizeText', () => {
  it('ignores case and accents', () => {
    expect(normalizeText('Ärger ÜBER Élan')).toBe('arger uber elan');
  });
});

describe('searchStories', () => {
  it('returns every story by rank for an empty query', () => {
    expect(codes('')).toEqual(['S-1', 'S-2', 'S-10', 'S-11', 'S-7']);
    expect(codes('   ')).toEqual(['S-1', 'S-2', 'S-10', 'S-11', 'S-7']);
  });

  it('finds a story by its key, with or without the dash and by its number', () => {
    expect(codes('s-7')).toEqual(['S-7']);
    expect(codes('s7')).toEqual(['S-7']);
    expect(codes('7')).toEqual(['S-7']);
    expect(codes('S-1')).toEqual(['S-1', 'S-10', 'S-11']);
  });

  it('puts the exact key before keys that only start with it', () => {
    expect(codes('s-1')[0]).toBe('S-1');
    expect(codes('S-10')).toEqual(['S-10']);
  });

  it('finds a story by a word of its title, in any case', () => {
    expect(codes('BACKLOG')).toEqual(['S-10']);
    expect(codes('story')).toEqual(['S-1', 'S-7']);
  });

  it('needs every word, in any order', () => {
    expect(codes('map story')).toEqual(['S-7']);
    expect(codes('story plan')).toEqual(['S-7']);
    expect(codes('story banana')).toEqual([]);
  });

  it('finds words inside other words and ignores accents on both sides', () => {
    expect(codes('arger')).toEqual(['S-11']);
    expect(codes('überblick')).toEqual(['S-11']);
    expect(codes('crit')).toEqual(['S-2']);
  });

  it('puts a key match before a title match and a title start before the rest', () => {
    const list = [story('S-3', 'Release 7 notes', 0), story('S-7', 'Plan', 1), story('S-8', 'Plan the 7 things', 2), story('S-9', '7 days', 3)];
    expect(searchStories(list, '7').map((item) => item.code)).toEqual(['S-7', 'S-9', 'S-3', 'S-8']);
  });

  it('does not change the list it was given', () => {
    const copy = [...stories];
    searchStories(stories, 'story');
    expect(stories).toEqual(copy);
  });
});
