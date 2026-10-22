// @vitest-environment node
// Keeps the colours of the design system readable (#70, ADR 0002, QR-04): contrast of every pair that is used, in both themes.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const css = readFileSync(join(resolve(__dirname, '../..'), 'docs/design/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function block(start: string): Record<string, string> {
  const from = css.indexOf(start);
  const body = css.slice(css.indexOf('{', from) + 1, css.indexOf('\n}', from));
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const themes: Record<'light' | 'dark', Record<string, string>> = {
  light: block(':root,\n:root[data-theme="light"]'),
  dark: { ...block(':root,\n:root[data-theme="light"]'), ...block(':root[data-theme="dark"]') }
};

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Text on a surface must reach 4.5:1. */
const TEXT_PAIRS: [string, string][] = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text', '--column'],
  ['--muted', '--bg'],
  ['--muted', '--surface'],
  ['--muted', '--column'],
  ['--accent-ink', '--accent'],
  ['--accent', '--surface'],
  ['--accent-soft-ink', '--accent-soft'],
  ['--danger', '--surface'],
  ['--danger', '--danger-soft'],
  ['--danger-ink', '--danger'],
  ['--warn', '--surface'],
  ['--warn', '--warn-soft'],
  ['--warn-ink', '--warn'],
  ['--ok-ink', '--ok'],
  ['--mark-ink', '--mark'],
  ['--tool-ink', '--tool-dark']
];

const EPICS = ['blue', 'amber', 'teal', 'violet', 'rose', 'green', 'cyan', 'slate'].map((key) => `--epic-${key}`);

describe('contrast of the colours', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`AC7.1 text and surfaces reach 4.5:1 in the ${theme} theme`, () => {
      // Given the colours of the theme
      const colors = themes[theme];
      // When we measure every pair of text on its surface
      const weak = TEXT_PAIRS.map(([text, surface]) => ({ pair: `${text} on ${surface}`, value: ratio(colors[text], colors[surface]) })).filter((entry) => entry.value < 4.5);
      // Then none is below 4.5:1
      expect(weak).toEqual([]);
    });

    test(`AC7.1 epic colours reach 3:1 on cards and columns in the ${theme} theme`, () => {
      // Given the colours of the theme
      const colors = themes[theme];
      // When we measure every epic colour on the card and on the column
      const weak = EPICS.flatMap((epic) => ['--surface', '--column'].map((surface) => ({ pair: `${epic} on ${surface}`, value: ratio(colors[epic], colors[surface]) }))).filter((entry) => entry.value < 3);
      // Then none is below 3:1
      expect(weak).toEqual([]);
    });
  }
});
