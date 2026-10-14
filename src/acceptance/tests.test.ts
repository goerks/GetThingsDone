import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACKAGE_1 } from './package1';

/** Every test case names the automated tests that cover it; this checks the names against the test files. */
describe('acceptance test cases and their automated tests', () => {
  const cases = PACKAGE_1.criteria.flatMap((criterion) => criterion.cases);

  it('every test case has an automated test, except those that only a person can check (manual, with a check for the PO)', () => {
    expect(cases.filter((testCase) => testCase.tests.length === 0 && !(testCase.manual && testCase.poCheck)).map((testCase) => testCase.id)).toEqual([]);
  });

  it.each(cases.flatMap((testCase) => testCase.tests.map((test) => [testCase.id, test] as const)))('%s: the test "%s" exists and starts with the id', (id, test) => {
    const [file, title] = test.split(' › ');
    expect(title.startsWith(`${id} `)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain(title);
  });
});
