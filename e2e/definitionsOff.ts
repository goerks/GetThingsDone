import { expect, type Page } from '@playwright/test';

/**
 * Switches the demo Definition of Ready and Done off for the tests of other features, which move stories across the
 * status categories and would otherwise meet the quality gate (#26). Opens the app once so the demo data exists, then
 * turns "check on status change" off in the stored settings and reloads; later `page.goto` calls keep it.
 */
export async function switchDefinitionsOff(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    const key = 'getitdone.snapshot.v1';
    const snapshot = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    snapshot.settings.definitions.ready.enforce = false;
    snapshot.settings.definitions.done.enforce = false;
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  });
  // The app keeps the settings in memory: it has to read them again.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
