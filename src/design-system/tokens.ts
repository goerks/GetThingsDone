import tokensCss from '../../docs/design/tokens.css?raw';

/** Every custom property of `docs/design/tokens.css` in file order, with the value of its first declaration. */
export function readTokens(): { name: string; value: string }[] {
  const seen = new Map<string, string>();
  const css = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!seen.has(match[1])) seen.set(match[1], match[2].trim());
  }
  return [...seen].map(([name, value]) => ({ name, value }));
}

export function tokensWithPrefix(...prefixes: string[]): { name: string; value: string }[] {
  return readTokens().filter((token) => prefixes.some((prefix) => token.name.startsWith(prefix)));
}

export const COLOR_GROUPS: { title: string; use: string; names: string[] }[] = [
  { title: 'Surfaces', use: 'Page, cards, columns, borders and chips.', names: ['--bg', '--surface', '--column', '--border', '--pill', '--track'] },
  { title: 'Text', use: 'Body text and secondary text. Both reach 4.5:1 on the surfaces.', names: ['--text', '--muted'] },
  { title: 'Accent', use: 'Main actions, links, selection and the focus ring.', names: ['--accent', '--accent-ink', '--accent-soft', '--accent-soft-ink'] },
  { title: 'Status', use: 'Danger, warning and success. Always with an icon and a text, never colour alone.', names: ['--danger', '--danger-soft', '--danger-ink', '--warn', '--warn-soft', '--warn-ink', '--ok', '--ok-soft', '--ok-ink'] },
  { title: 'Search and overlay', use: 'Matched text in search results and the dimmed area behind dialogs.', names: ['--mark', '--mark-ink', '--overlay', '--shadow', '--shadow-strong'] },
  { title: 'Epic palette', use: 'A small dot next to the epic name. At least 3:1 against cards and columns.', names: ['--epic-blue', '--epic-amber', '--epic-teal', '--epic-violet', '--epic-rose', '--epic-green', '--epic-cyan', '--epic-slate'] },
  { title: 'Preview tool', use: 'The acceptance panel of the preview only. Used nowhere in the product.', names: ['--tool', '--tool-ink', '--tool-dark'] }
];
