import { describe, expect, it } from 'vitest';
import { notDone, notReady } from '../domain/definitions';
import { PACKAGES } from './packages';
import { PRESETS } from './presets';

const build = (id: string) => {
  const preset = PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  return preset.build('2026-10-13');
};

describe('test data for the acceptance of the definitions (#26)', () => {
  it('every test case of every package names a test data set that exists', () => {
    const ids = new Set(PRESETS.map((preset) => preset.id));
    for (const pack of Object.values(PACKAGES)) {
      for (const testCase of pack.criteria.flatMap((criterion) => criterion.cases)) {
        if ('preset' in testCase && testCase.preset) expect(ids.has(testCase.preset), `${testCase.id}: ${testCase.preset}`).toBe(true);
      }
    }
  });

  it('AC1.5 the demo data and "both off" have both lists off; "both on", "only Ready" and "only Done" switch them as named', () => {
    const state = (id: string) => [build(id).settings.definitions.ready.enforce, build(id).settings.definitions.done.enforce];
    expect(state('demo')).toEqual([false, false]);
    expect(state('definitionsOff')).toEqual([false, false]);
    expect(state('definitionsOn')).toEqual([true, true]);
    expect(state('definitionsReadyOnly')).toEqual([true, false]);
    expect(state('definitionsDoneOnly')).toEqual([false, true]);
  });

  it('AC5.5 the data with empty lists has two empty lists that are on', () => {
    const { definitions } = build('definitionsEmpty').settings;
    expect([definitions.ready.groups, definitions.done.groups]).toEqual([[], []]);
  });

  it('AC5.1 the data for the marks has a ready, a nearly ready and a not ready story, a done story that is marked and one that is not', () => {
    const snapshot = build('definitionsMarks');
    const { definitions } = snapshot.settings;
    const story = (code: string) => {
      const found = snapshot.stories.find((item) => item.code === code);
      if (!found) throw new Error(code);
      return found;
    };
    expect(notReady(definitions, story('S-3'), false)).toBeNull();
    expect(notReady(definitions, story('S-6'), false)).toMatchObject({ checked: 3, total: 5 });
    expect(notReady(definitions, story('S-7'), false)).toMatchObject({ checked: 1, total: 5 });
    expect(notDone(definitions, story('S-2'), true)).toMatchObject({ checked: 1, total: 3 });
    expect(notDone(definitions, story('S-5'), true)).toBeNull();
  });
});
