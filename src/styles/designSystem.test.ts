// @vitest-environment node
// Keeps the app on the design system (#70, ADR 0006): no raw design values outside docs/design/tokens.css.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const appCss = stripComments(readFileSync(join(root, 'src/styles/app.css'), 'utf8'));
const tokensCss = stripComments(readFileSync(join(root, 'docs/design/tokens.css'), 'utf8'));

/** Declarations of app.css as [property, value] with `var(...)` removed, so fallbacks do not count. */
const declarations: [string, string][] = [...appCss.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g)].map((m) => [
  m[1],
  m[2].replace(/var\((?:[^()]|\([^()]*\))*\)/g, 'var()')
]);

const forbidden = (properties: RegExp, value: RegExp): string[] =>
  declarations.filter(([property, text]) => properties.test(property) && value.test(text)).map(([property, text]) => `${property}: ${text}`);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('design system: no raw values in the app', () => {
  test('AC3.2 colours come from tokens: no hex, rgb or rgba outside the token file', () => {
    // Given the style sheet of the app
    // When we look for colour literals
    const literals = declarations.filter(([, text]) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(text)).map(([property, text]) => `${property}: ${text}`);
    // Then there are none
    expect(literals).toEqual([]);
  });

  test('AC3.2 font sizes, line heights, weights and radii come from tokens', () => {
    // Given the style sheet of the app
    // When we look for raw type and shape values
    const found = [
      ...forbidden(/^font-size$/, /\d(px|rem)\b/),
      ...forbidden(/^line-height$/, /^[\d.]+(px)?$/),
      ...forbidden(/^font-weight$/, /^\d+$/),
      ...forbidden(/^border(-[a-z]+)*-radius$/, /\d+(px|%)/)
    ];
    // Then there are none
    expect(found).toEqual([]);
  });

  test('AC3.2 spacings come from tokens (gaps, padding, margins and offsets)', () => {
    // Given the style sheet of the app
    // When we look for raw pixel spacings
    const found = forbidden(/^(padding|margin|gap|row-gap|column-gap|top|right|bottom|left|inset)(-[a-z]+)*$/, /\d+px/);
    // Then there are none
    expect(found).toEqual([]);
  });

  test('AC3.2 layers, shadows and durations come from tokens', () => {
    // Given the style sheet of the app
    // When we look for raw layers, shadow colours and durations
    const found = [
      ...forbidden(/^z-index$/, /^-?\d+$/),
      ...forbidden(/^box-shadow$/, /rgba?\(/),
      ...forbidden(/^transition(-duration)?$/, /\d(ms|s)\b/)
    ];
    // Then there are none
    expect(found).toEqual([]);
  });

  test('AC3.2 media queries use the two documented widths', () => {
    // Given the style sheet of the app
    // When we collect the widths of its media queries
    const widths = new Set([...appCss.matchAll(/@media[^{]*\(max-width:\s*(\d+)px\)/g)].map((m) => m[1]));
    // Then only the small (640 px) and medium (760 px) breakpoints occur
    expect([...widths].filter((width) => !['640', '760'].includes(width))).toEqual([]);
  });

  test('AC3.2 every token the style sheet uses is defined', () => {
    // Given the custom properties that are used in the style sheet
    const used = new Set([...appCss.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    // And everything that is defined: the token file, the style sheet and inline custom properties in the components
    const defined = new Set([...(tokensCss + appCss).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const file of sourceFiles(join(root, 'src'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/['"`](--[a-z0-9-]+)['"`]/g)) defined.add(m[1]);
    }
    // Then none is missing
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });

  test('AC3.2 components and pages have no colour literals', () => {
    // Given the components and pages of the app
    const files = ['src/components', 'src/pages', 'src/state', 'src/ui'].flatMap((dir) => sourceFiles(join(root, dir))).filter((file) => !/\.(test|stories)\.tsx?$/.test(file));
    // When we look for colour literals
    const found = files.filter((file) => /#[0-9a-fA-F]{6}\b|\brgba?\(/.test(readFileSync(file, 'utf8')));
    // Then there are none
    expect(found).toEqual([]);
  });

  test('AC8.2 buttons and form fields come from src/ui, no raw tags elsewhere', () => {
    // Given the components and pages of the app, without the shared components, the tests, the stories and the preview-only acceptance panel
    const files = sourceFiles(join(root, 'src')).filter(
      (file) => !/\/src\/(ui|acceptance|design-system)\//.test(file) && !/\.(test|stories)\.tsx?$/.test(file)
    );
    // When we look for raw button, input, select and textarea tags
    const found = files.filter((file) => /<(button|input|select|textarea)[\s>/]/.test(readFileSync(file, 'utf8'))).map((file) => file.replace(root, ''));
    // Then there are none
    expect(found).toEqual([]);
  });
});
