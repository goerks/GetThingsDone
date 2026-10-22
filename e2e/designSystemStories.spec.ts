import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

/*
 * The design system catalogue (#70): every story is checked for accessibility (axe, with colour contrast, in a real
 * browser) and compared with a reference image, in the light and in the dark theme. The catalogue is the Storybook
 * build served on port 4174 (see playwright.config.ts). A visual change fails until the reference images are renewed on purpose.
 */

const CATALOGUE = 'http://localhost:4174';
const axePath = createRequire(import.meta.url).resolve('axe-core');

interface IndexEntry {
  id: string;
  type: string;
}

interface Violation {
  id: string;
  help: string;
  nodes: { target: string[] }[];
}

async function storyIds(page: Page): Promise<string[]> {
  const response = await page.request.get(`${CATALOGUE}/index.json`);
  const index = (await response.json()) as { entries: Record<string, IndexEntry> };
  return Object.values(index.entries)
    .filter((entry) => entry.type === 'story')
    .map((entry) => entry.id)
    .sort();
}

async function showStory(page: Page, id: string, theme: 'light' | 'dark'): Promise<void> {
  await page.goto(`${CATALOGUE}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
  await page.waitForSelector('body.sb-show-main');
  await page.evaluate(() => document.fonts.ready);
  // Stories with a play function (hover, focus) are given a moment to finish
  await page.waitForTimeout(600);
}

for (const theme of ['light', 'dark'] as const) {
  test(`AC7.2 every story of the catalogue passes the accessibility check in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(300_000);
    // Given the catalogue with all its stories
    const ids = await storyIds(page);
    expect(ids.length).toBeGreaterThan(20);
    const problems: string[] = [];

    for (const id of ids) {
      // When a story is shown and checked with axe, including colour contrast
      await showStory(page, id, theme);
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (context: string, options: object) => Promise<{ violations: Violation[] }> } }).axe;
        const result = await axe.run('#storybook-root', {
          // A story is a part of a page: no landmarks, no heading one
          rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false }, 'landmark-one-main': { enabled: false } }
        });
        return result.violations;
      });
      // Then it has no violation
      for (const violation of violations) problems.push(`${id}: ${violation.id} (${violation.help}) at ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
    }

    expect(problems).toEqual([]);
  });

  test(`AC7.3 every story of the catalogue looks like its reference image in the ${theme} theme`, async ({ page }) => {
    test.setTimeout(300_000);
    // Given the catalogue and a window of a fixed size
    await page.setViewportSize({ width: 900, height: 700 });
    const ids = await storyIds(page);

    for (const id of ids) {
      // When a story is shown
      await showStory(page, id, theme);
      // Then it looks like its reference image
      await expect.soft(page).toHaveScreenshot(`${id}-${theme}.png`, { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 });
    }
  });
}
