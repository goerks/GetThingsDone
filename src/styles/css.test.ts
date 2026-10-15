import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app.css', () => {
  it('has balanced braces, so that no rule swallows the ones after it', () => {
    // Given the style sheet without comments and strings
    const css = readFileSync('src/styles/app.css', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/"[^"\n]*"|'[^'\n]*'/g, '');
    // When the braces are counted
    let depth = 0;
    let lowest = 0;
    for (const char of css) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      lowest = Math.min(lowest, depth);
    }
    // Then every block is closed
    expect(depth).toBe(0);
    expect(lowest).toBe(0);
  });
});
