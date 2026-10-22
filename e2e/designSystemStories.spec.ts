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

/** Stories with a play function (hover, focus) are given a moment to finish. */
const PLAYS = /hover|focus/;

async function showStory(page: Page, id: string, theme: 'light' | 'dark'): Promise<void> {
  // The demo data of the app stories depend on today's date
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto(`${CATALOGUE}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
  await page.waitForSelector('body.sb-show-main', { state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  if (PLAYS.test(id)) await page.waitForTimeout(600);
}

test('AC9.5 checks every app component page with the same accessibility and image tests', async ({ page }) => {
  // Given the catalogue
  const ids = await storyIds(page);
  // Then the pages of the app components are among its stories, so the checks below cover them
  const app = ids.filter((id) => id.startsWith('app--'));
  expect(app).toEqual(
    expect.arrayContaining([
      'app--story-cards',
      'app--story-cards-compact',
      'app--epic-tag-list',
      'app--release-card-list',
      'app--sprint-card-list',
      'app--board-lanes',
      'app--board-lane-drop-target',
      'app--header-bar',
      'app--member-filter',
      'app--context-menu-open',
      'app--toast-notice',
      'app--story-dialog-open',
      'app--epic-dialog-open',
      'app--sprint-dialog-open',
      'app--release-dialog-open'
    ])
  );
});

/** Runs axe on the story. The accessibility addon of Storybook runs it too when a story is shown: wait for that run to end. */
async function checkAccessibility(page: Page): Promise<Violation[]> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (context: string, options: object) => Promise<{ violations: Violation[] }> } }).axe;
        const result = await axe.run('#storybook-root', {
          // A story is a part of a page: no landmarks, no heading one
          rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false }, 'landmark-one-main': { enabled: false } }
        });
        return result.violations;
      });
    } catch (error) {
      if (attempt >= 20 || !String(error).includes('already running')) throw error;
      await page.waitForTimeout(250);
    }
  }
}

/** The stories are shared among a few tests per theme, so that they run in parallel. */
const PARTS = [0, 1, 2, 3];
const part = (ids: string[], index: number): string[] => ids.filter((_, position) => position % PARTS.length === index);

for (const theme of ['light', 'dark'] as const) {
  for (const index of PARTS) {
    test(`AC7.2 every story of the catalogue passes the accessibility check in the ${theme} theme (part ${index + 1})`, async ({ page }) => {
      test.setTimeout(300_000);
      // Given the catalogue with all its stories
      const all = await storyIds(page);
      expect(all.length).toBeGreaterThan(20);
      const problems: string[] = [];

      for (const id of part(all, index)) {
        // When a story is shown and checked with axe, including colour contrast
        await showStory(page, id, theme);
        await page.addScriptTag({ path: axePath });
        const violations = await checkAccessibility(page);
        // Then it has no violation
        for (const violation of violations) problems.push(`${id}: ${violation.id} (${violation.help}) at ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
      }

      expect(problems).toEqual([]);
    });

    test(`AC7.3 every story of the catalogue looks like its reference image in the ${theme} theme (part ${index + 1})`, async ({ page }) => {
      test.setTimeout(300_000);
      // Given the catalogue and a window of a fixed size
      await page.setViewportSize({ width: 900, height: 700 });
      const all = await storyIds(page);

      for (const id of part(all, index)) {
        // When a story is shown
        await showStory(page, id, theme);
        // Then it looks like its reference image
        await expect.soft(page).toHaveScreenshot(`${id}-${theme}.png`, { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 });
      }
    });
  }
}
