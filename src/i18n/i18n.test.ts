import { describe, expect, it } from 'vitest';
import german from './de.json';
import english from './en.json';
import french from './fr.json';
import italian from './it.json';

/** Every key of a nested translation file as a dotted path, without the plural suffix. */
function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

const plural = /_(one|other|zero|few|many|two)$/;

describe('translations', () => {
  const reference = new Set(keys(english).map((key) => key.replace(plural, '')));

  it.each([
    ['de', german],
    ['fr', french],
    ['it', italian]
  ])('%s has the same texts as English', (_name, file) => {
    const own = new Set(keys(file).map((key) => key.replace(plural, '')));
    expect([...reference].filter((key) => !own.has(key))).toEqual([]);
    expect([...own].filter((key) => !reference.has(key))).toEqual([]);
  });
});
